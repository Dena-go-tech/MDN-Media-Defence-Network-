package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            BIGSERIAL PRIMARY KEY,
	email         TEXT NOT NULL UNIQUE,
	name          TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	role          TEXT NOT NULL DEFAULT 'user',
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news (
	id         BIGSERIAL PRIMARY KEY,
	title      TEXT NOT NULL,
	summary    TEXT NOT NULL DEFAULT '',
	body       TEXT NOT NULL DEFAULT '',
	image_url  TEXT NOT NULL DEFAULT '',
	featured   BOOLEAN NOT NULL DEFAULT false,
	published  BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
	id          BIGSERIAL PRIMARY KEY,
	title       TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	questions   JSONB NOT NULL DEFAULT '[]',
	published   BOOLEAN NOT NULL DEFAULT true,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_scripts (
	id         BIGSERIAL PRIMARY KEY,
	question   TEXT NOT NULL,
	answer     TEXT NOT NULL,
	verdict    TEXT NOT NULL DEFAULT 'none',
	position   INT NOT NULL DEFAULT 0,
	published  BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
	id         BIGSERIAL PRIMARY KEY,
	user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	test_id    BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
	score      INT NOT NULL,
	total      INT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE news ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT '';

ALTER TABLE results ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS assistant_settings (
	id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
	system_prompt TEXT NOT NULL,
	site_context  BOOLEAN NOT NULL DEFAULT true,
	web_search    BOOLEAN NOT NULL DEFAULT true,
	updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- kind: 'quiz' (graded, has correct answers) or 'survey' (anonymous poll, no correct answers).
ALTER TABLE tests ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'quiz';

-- Kyrgyz translations of content; empty fields fall back to the Russian original.
ALTER TABLE news ADD COLUMN IF NOT EXISTS ky JSONB NOT NULL DEFAULT '{}';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS ky JSONB NOT NULL DEFAULT '{}';

-- Anonymous survey answers: answers[i] is the list of option indexes chosen for question i.
CREATE TABLE IF NOT EXISTS survey_responses (
	id         BIGSERIAL PRIMARY KEY,
	test_id    BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
	answers    JSONB NOT NULL,
	lang       TEXT NOT NULL DEFAULT 'ru',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS survey_responses_test_idx ON survey_responses (test_id);
-- 'site' = answered on the portal, 'import' = loaded from an outside poll (e.g. the Google Form).
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'site';

-- News channels polled over RSS: all feed the rating, those with import_news also publish news.
CREATE TABLE IF NOT EXISTS news_sources (
	id            BIGSERIAL PRIMARY KEY,
	name          TEXT NOT NULL,
	url           TEXT NOT NULL,
	feed_url      TEXT NOT NULL UNIQUE,
	is_state      BOOLEAN NOT NULL DEFAULT false,
	import_news   BOOLEAN NOT NULL DEFAULT false,
	category      TEXT NOT NULL DEFAULT '',
	enabled       BOOLEAN NOT NULL DEFAULT true,
	last_status   TEXT NOT NULL DEFAULT 'pending',
	last_error    TEXT NOT NULL DEFAULT '',
	last_fetch_at TIMESTAMPTZ,
	fetch_ok      INT NOT NULL DEFAULT 0,
	fetch_total   INT NOT NULL DEFAULT 0,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every item seen in a channel's feed: rating history, and the reason deleted imports stay deleted.
CREATE TABLE IF NOT EXISTS source_items (
	id           BIGSERIAL PRIMARY KEY,
	source_id    BIGINT NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
	guid         TEXT NOT NULL,
	title        TEXT NOT NULL,
	link         TEXT NOT NULL,
	published_at TIMESTAMPTZ, -- NULL: the feed gives no date and the item predates our first poll
	UNIQUE (source_id, guid)
);
CREATE INDEX IF NOT EXISTS source_items_recent_idx ON source_items (source_id, published_at DESC);

-- Runs once, when the column appears. What import channels already hold counts as handled, so
-- deleted news stays deleted. The other channels start importing, and the two whose RSS is
-- closed by robots.txt move to their sitemaps.
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_items' AND column_name = 'imported') THEN
		ALTER TABLE source_items ADD COLUMN imported BOOLEAN NOT NULL DEFAULT false;
		UPDATE source_items i SET imported = true FROM news_sources s WHERE s.id = i.source_id AND s.import_news;
		UPDATE news_sources SET import_news = true, category = 'СМИ'
			WHERE feed_url IN ('https://24.kg/rss/', 'https://kg.akipress.org/rss', 'https://kaktus.media/?rss', 'https://kloop.kg/feed/', 'https://vesti.kg/index.php?format=feed') AND NOT import_news;
		UPDATE news_sources SET feed_url = 'https://ktrk.kg/sitemap_index.xml' WHERE feed_url = 'https://ktrk.kg/feed/';
		UPDATE news_sources SET feed_url = 'https://kaktus.media/other/sitemap.php?sitemap=sitemap.xml' WHERE feed_url = 'https://kaktus.media/?rss';
	END IF;
END $$;

-- One row per user is what limits everyone to a single vote across all channels.
CREATE TABLE IF NOT EXISTS source_votes (
	user_id   BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	source_id BIGINT NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
	voted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_votes_source_idx ON source_votes (source_id);

-- Set on imported news; the name is copied so articles outlive a deleted channel.
ALTER TABLE news ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '';
ALTER TABLE news ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE news ADD COLUMN IF NOT EXISTS source_id BIGINT REFERENCES news_sources(id) ON DELETE SET NULL;
UPDATE news n SET source_id = s.id FROM news_sources s
	WHERE n.source_id IS NULL AND n.source_url <> '' AND s.name = n.source_name;
-- Tries at reading the original page for missing text or a picture.
ALTER TABLE news ADD COLUMN IF NOT EXISTS body_attempts INT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS news_source_url_idx ON news (source_url) WHERE source_url <> '';
`

func migrate(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, schema)
	return err
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	return json.NewDecoder(r.Body).Decode(v)
}

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func isNotFound(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
