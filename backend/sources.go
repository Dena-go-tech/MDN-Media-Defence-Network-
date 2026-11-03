package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// News channels are polled over RSS/Atom. Every channel feeds the rating page; channels
// with import_news also publish their items as news: headline, lead, about 70% of the
// text (see article.go) and a link to the original for the rest.

const (
	syncInterval      = 30 * time.Minute
	syncSourceTimeout = 30 * time.Second
	maxFeedBytes      = 5 << 20
	maxRobotsBytes    = 512 << 10
	botName           = "MDNKG-NewsBot"
	botUserAgent      = botName + "/1.0 (Media Defence Network KG news aggregator)"

	// Retention counts items per channel, not days: a fact-checker posting monthly keeps
	// its articles, while a busy agency still keeps well over the rating's 7-day window.
	importKeepPerSource = 2000 // deep enough for the endless feed
	itemKeepPerSource   = 5000

	statusPending = "pending"
	statusOK      = "ok"
	statusError   = "error"
	statusBlocked = "blocked" // the site's robots.txt forbids reading the feed
)

var errRobotsBlocked = errors.New("robots.txt запрещает чтение ленты")

// publicDialer refuses internal addresses, so a feed URL (or a redirect) cannot reach
// the database or other containers on the Docker network.
var publicDialer = &net.Dialer{
	Timeout: 10 * time.Second,
	Control: func(_, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		if ip := net.ParseIP(host); ip == nil || !ip.IsGlobalUnicast() || ip.IsPrivate() {
			return fmt.Errorf("адрес %s недоступен", host)
		}
		return nil
	},
}

var feedTransport = &http.Transport{DialContext: publicDialer.DialContext, TLSHandshakeTimeout: 10 * time.Second}

// feedClient re-checks robots.txt on every redirect hop.
var feedClient = &http.Client{Transport: feedTransport}

func init() {
	// Set here because checkRobots itself uses the clients.
	feedClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("слишком много перенаправлений")
		}
		return checkRobots(req.Context(), req.URL)
	}
}

var robotsClient = &http.Client{Transport: feedTransport}

func botRequest(ctx context.Context, u string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", botUserAgent)
	// The robots.txt request itself must not trigger another robots check on redirect.
	if req.URL.Path == "/robots.txt" {
		return robotsClient.Do(req)
	}
	return feedClient.Do(req)
}

// checkRobots follows RFC 9309: a missing robots.txt allows everything, while a server
// error counts as "cannot tell" and the feed is left alone until the next cycle.
func checkRobots(ctx context.Context, target *url.URL) error {
	res, err := botRequest(ctx, target.Scheme+"://"+target.Host+"/robots.txt")
	if err != nil {
		return fmt.Errorf("robots.txt: %w", err)
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode >= 500:
		return fmt.Errorf("robots.txt: HTTP %d", res.StatusCode)
	case res.StatusCode >= 400:
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, maxRobotsBytes))
	if err != nil {
		return fmt.Errorf("robots.txt: %w", err)
	}
	if !robotsAllowed(string(body), botName, target.RequestURI()) {
		return errRobotsBlocked
	}
	return nil
}

// fetchFeed reads a channel's address. A feed gives items straight away; a sitemap only
// gives page addresses, returned for readSitemapPages.
func fetchFeed(ctx context.Context, feedURL string) ([]FeedItem, []sitemapEntry, error) {
	doc, err := fetchFeedDoc(ctx, feedURL)
	if err != nil {
		return nil, nil, err
	}
	if len(doc.Sitemaps) > 0 {
		sitemaps := newestEntries(doc.Sitemaps)
		sitemaps = sitemaps[:min(sitemapsPerPoll, len(sitemaps))]
		for _, entry := range sitemaps {
			part, err := fetchFeedDoc(ctx, entry.Loc)
			if err != nil {
				return nil, nil, err
			}
			doc.URLs = append(doc.URLs, part.URLs...)
		}
	}
	if len(doc.URLs) > 0 {
		return nil, newestEntries(doc.URLs), nil
	}
	items, err := doc.items()
	return items, nil, err
}

func fetchFeedDoc(ctx context.Context, feedURL string) (xmlFeed, error) {
	u, err := url.Parse(feedURL)
	if err != nil {
		return xmlFeed{}, err
	}
	if err := checkRobots(ctx, u); err != nil {
		return xmlFeed{}, err
	}
	res, err := botRequest(ctx, feedURL)
	if err != nil {
		// CheckRedirect errors arrive wrapped in *url.Error, which errors.Is sees through.
		return xmlFeed{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return xmlFeed{}, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return decodeFeed(io.LimitReader(res.Body, maxFeedBytes))
}

// Source is a news channel.
type Source struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	URL        string     `json:"url"`
	FeedURL    string     `json:"feed_url"`
	IsState    bool       `json:"is_state"`
	ImportNews bool       `json:"import_news"`
	Category   string     `json:"category"` // rubric of the news it imports
	Enabled    bool       `json:"enabled"`
	LastStatus string     `json:"last_status"`
	LastError  string     `json:"last_error"`
	LastFetch  *time.Time `json:"last_fetch_at"`
	FetchOK    int        `json:"fetch_ok"`
	FetchTotal int        `json:"fetch_total"`
	Posts7d    int        `json:"posts_7d"`
}

// defaultSources are the channels whose feeds were checked by hand. Admins manage the
// list afterwards, so they are only added to an empty table.
var defaultSources = []Source{
	{Name: "Кабар", URL: "https://ru.kabar.kg/", FeedURL: "https://ru.kabar.kg/rss.xml", IsState: true, ImportNews: true, Category: "Госисточники", Enabled: true},
	{Name: "Нацстатком", URL: "https://stat.gov.kg/", FeedURL: "https://stat.gov.kg/ru/rss/", IsState: true, ImportNews: true, Category: "Госисточники", Enabled: true},
	{Name: "КТРК", URL: "https://ktrk.kg/", FeedURL: "https://ktrk.kg/sitemap_index.xml", IsState: true, ImportNews: true, Category: "Госисточники", Enabled: true},
	{Name: "Factcheck.kg", URL: "https://factcheck.kg/", FeedURL: "https://factcheck.kg/feed/", ImportNews: true, Category: "Проверка фактов", Enabled: true},
	{Name: "24.kg", URL: "https://24.kg/", FeedURL: "https://24.kg/rss/", ImportNews: true, Category: "СМИ", Enabled: true},
	{Name: "AKIpress", URL: "https://kg.akipress.org/", FeedURL: "https://kg.akipress.org/rss", ImportNews: true, Category: "СМИ", Enabled: true},
	{Name: "Kaktus.media", URL: "https://kaktus.media/", FeedURL: "https://kaktus.media/other/sitemap.php?sitemap=sitemap.xml", ImportNews: true, Category: "СМИ", Enabled: true},
	{Name: "Kloop", URL: "https://kloop.kg/", FeedURL: "https://kloop.kg/feed/", ImportNews: true, Category: "СМИ", Enabled: true},
	{Name: "Vesti.kg", URL: "https://vesti.kg/", FeedURL: "https://vesti.kg/index.php?format=feed", ImportNews: true, Category: "СМИ", Enabled: true},
}

func (a *App) seedSources(ctx context.Context) error {
	var n int
	if err := a.db.QueryRow(ctx, `SELECT count(*) FROM news_sources`).Scan(&n); err != nil || n > 0 {
		return err
	}
	for _, s := range defaultSources {
		if _, err := a.db.Exec(ctx, `
			INSERT INTO news_sources (name, url, feed_url, is_state, import_news, category, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			s.Name, s.URL, s.FeedURL, s.IsState, s.ImportNews, s.Category, s.Enabled); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) syncLoop(ctx context.Context) {
	for {
		a.syncSources(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(syncInterval):
		}
	}
}

// syncSources polls every enabled channel. A run already in progress makes this a no-op.
func (a *App) syncSources(ctx context.Context) {
	if !a.syncMu.TryLock() {
		return
	}
	defer a.syncMu.Unlock()

	rows, err := a.db.Query(ctx, `SELECT id, feed_url, name, import_news, category FROM news_sources WHERE enabled ORDER BY id`)
	if err != nil {
		log.Printf("sources: %v", err)
		return
	}
	var list []Source
	for rows.Next() {
		var s Source
		if err := rows.Scan(&s.ID, &s.FeedURL, &s.Name, &s.ImportNews, &s.Category); err != nil {
			rows.Close()
			log.Printf("sources: %v", err)
			return
		}
		list = append(list, s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		log.Printf("sources: %v", err)
		return
	}

	for _, s := range list {
		a.syncSource(ctx, s)
	}

	a.fillFromPages(ctx)

	// Featured items were picked by an editor, so they stay.
	if _, err := a.db.Exec(ctx, `
		DELETE FROM news WHERE NOT featured AND id IN (
			SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY source_name ORDER BY created_at DESC) AS n
				FROM news WHERE source_url <> '') ranked WHERE n > $1)`, importKeepPerSource); err != nil {
		log.Printf("sources: prune news: %v", err)
	}
	if _, err := a.db.Exec(ctx, `
		DELETE FROM source_items WHERE id IN (
			SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY source_id ORDER BY published_at DESC NULLS LAST) AS n
				FROM source_items) ranked WHERE n > $1)`, itemKeepPerSource); err != nil {
		log.Printf("sources: prune items: %v", err)
	}
}

func (a *App) syncSource(parent context.Context, s Source) {
	ctx, cancel := context.WithTimeout(parent, syncSourceTimeout)
	defer cancel()

	items, pages, err := fetchFeed(ctx, s.FeedURL)
	if err == nil && len(pages) > 0 {
		// Reading pages takes longer than the feed timeout allows, so it has its own.
		items, err = a.readSitemapPages(parent, s, pages)
	}
	if err == nil {
		storeCtx, cancelStore := context.WithTimeout(parent, syncSourceTimeout)
		defer cancelStore()
		err = a.storeItems(storeCtx, s, items)
	}
	status, msg, ok, total := statusOK, "", 1, 1
	switch {
	case errors.Is(err, errRobotsBlocked):
		// The site's own choice, so it is not an availability failure.
		status, msg, ok, total = statusBlocked, err.Error(), 0, 0
	case err != nil:
		status, msg, ok, total = statusError, err.Error(), 0, 1
		log.Printf("sources: %s: %v", s.Name, err)
	}
	if _, err := a.db.Exec(parent, `
		UPDATE news_sources SET last_fetch_at = now(), last_status = $2, last_error = $3,
			fetch_ok = fetch_ok + $4, fetch_total = fetch_total + $5 WHERE id = $1`,
		s.ID, status, msg, ok, total); err != nil {
		log.Printf("sources: %s: %v", s.Name, err)
	}
}

// storeItems records new items for the rating and publishes them as news when the channel
// imports. source_items.imported remembers what was published, so news an admin deleted does
// not come back while it is still in the feed, and turning import on picks up what is there.
func (a *App) storeItems(ctx context.Context, s Source, items []FeedItem) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var firstRun bool
	if err := tx.QueryRow(ctx, `SELECT NOT EXISTS (SELECT 1 FROM source_items WHERE source_id = $1)`, s.ID).Scan(&firstRun); err != nil {
		return err
	}
	now := time.Now()
	for _, it := range items {
		// For a feed without dates, the moment an item appears is a fair estimate between
		// polls. The backlog found on the first poll has no such estimate: its age is
		// unknown, so it neither counts as activity nor goes out as fresh news. A sitemap
		// page that turned out not to be an article (no title) is treated the same way.
		published := &it.Published
		if it.Title == "" {
			published = nil
		} else if it.Published.IsZero() {
			published = &now
			if firstRun {
				published = nil
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO source_items (source_id, guid, title, link, published_at) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (source_id, guid) DO NOTHING`, s.ID, it.GUID, it.Title, it.Link, published); err != nil {
			return err
		}
		if !s.ImportNews {
			continue
		}
		var imported bool
		var date *time.Time
		if err := tx.QueryRow(ctx, `SELECT imported, published_at FROM source_items WHERE source_id = $1 AND guid = $2`, s.ID, it.GUID).Scan(&imported, &date); err != nil {
			return err
		}
		if date == nil {
			continue
		}
		if imported {
			// News imported before its text was available catches up here.
			if it.Body != "" {
				if _, err := tx.Exec(ctx, `UPDATE news SET body = $1 WHERE source_url = $2 AND body = ''`, it.Body, it.Link); err != nil {
					return err
				}
			}
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO news (title, summary, body, image_url, category, published, created_at, source_id, source_name, source_url)
			VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
			ON CONFLICT (source_url) WHERE source_url <> '' DO NOTHING`,
			it.Title, it.Summary, it.Body, it.Image, s.Category, *date, s.ID, s.Name, it.Link); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE source_items SET imported = true WHERE source_id = $1 AND guid = $2`, s.ID, it.GUID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// activityScore is 0–100: up to 50 for volume (20 posts a day earns the maximum), 30 for
// freshness (full within 6 hours of the last post, zero after 3 days) and 20 for how
// often the feed answered. It says how active a channel is, not how good or reliable,
// and only breaks ties between equal vote counts.
func activityScore(posts7d int, last *time.Time, ok, total int, now time.Time) int {
	volume := math.Min(float64(posts7d)/140, 1) * 50
	fresh := 0.0
	if last != nil {
		hours := now.Sub(*last).Hours()
		fresh = math.Max(0, math.Min(1, 1-(hours-6)/66)) * 30
	}
	avail := 0.0
	if total > 0 {
		avail = float64(ok) / float64(total) * 20
	}
	return int(math.Round(volume + fresh + avail))
}

type RatingRow struct {
	ID           int64      `json:"id"`
	Rank         int        `json:"rank"`
	Name         string     `json:"name"`
	URL          string     `json:"url"`
	IsState      bool       `json:"is_state"`
	Votes        int        `json:"votes"`
	Activity     int        `json:"activity"`
	Posts7d      int        `json:"posts_7d"`
	LastPost     *time.Time `json:"last_post_at"`
	Availability int        `json:"availability"`
	Status       string     `json:"status"`
}

type Rating struct {
	UpdatedAt  *time.Time  `json:"updated_at"`
	TotalVotes int         `json:"total_votes"`
	MyVote     *int64      `json:"my_vote"` // only for a signed-in visitor who has voted
	Rows       []RatingRow `json:"rows"`
}

func (a *App) rating(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT s.id, s.name, s.url, s.is_state, s.last_status, s.fetch_ok, s.fetch_total, s.last_fetch_at,
			(SELECT count(*) FROM source_votes v WHERE v.source_id = s.id),
			(SELECT count(*) FROM source_items i WHERE i.source_id = s.id AND i.published_at > now() - interval '7 days'),
			(SELECT max(i.published_at) FROM source_items i WHERE i.source_id = s.id)
		FROM news_sources s WHERE s.enabled`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	now := time.Now()
	out := Rating{Rows: []RatingRow{}}
	for rows.Next() {
		var row RatingRow
		var ok, total int
		var fetched *time.Time
		if err := rows.Scan(&row.ID, &row.Name, &row.URL, &row.IsState, &row.Status, &ok, &total, &fetched, &row.Votes, &row.Posts7d, &row.LastPost); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		if total > 0 {
			row.Availability = int(math.Round(float64(ok) / float64(total) * 100))
		}
		// A site that closed its feed has no measured activity, but can still be voted for.
		if ok > 0 && row.Status != statusBlocked {
			row.Activity = activityScore(row.Posts7d, row.LastPost, ok, total, now)
		}
		if fetched != nil && (out.UpdatedAt == nil || fetched.After(*out.UpdatedAt)) {
			out.UpdatedAt = fetched
		}
		out.TotalVotes += row.Votes
		out.Rows = append(out.Rows, row)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	rankRows(out.Rows)

	if u := a.userFromToken(r); u != nil {
		var id int64
		err := a.db.QueryRow(r.Context(), `SELECT source_id FROM source_votes WHERE user_id = $1`, u.ID).Scan(&id)
		if err == nil {
			out.MyVote = &id
		} else if !isNotFound(err) {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// rankRows orders channels by votes, with activity and then the name settling ties.
func rankRows(rows []RatingRow) {
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := rows[i], rows[j]
		if a.Votes != b.Votes {
			return a.Votes > b.Votes
		}
		if a.Activity != b.Activity {
			return a.Activity > b.Activity
		}
		return a.Name < b.Name
	})
	for i := range rows {
		rows[i].Rank = i + 1
	}
}

// vote casts the user's only vote; voting for another channel moves it there.
func (a *App) vote(w http.ResponseWriter, r *http.Request) {
	var in struct {
		SourceID int64 `json:"source_id"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		INSERT INTO source_votes (user_id, source_id)
		SELECT $1, id FROM news_sources WHERE id = $2 AND enabled
		ON CONFLICT (user_id) DO UPDATE SET source_id = EXCLUDED.source_id, voted_at = now()`,
		userFrom(r).ID, in.SourceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) unvote(w http.ResponseWriter, r *http.Request) {
	if _, err := a.db.Exec(r.Context(), `DELETE FROM source_votes WHERE user_id = $1`, userFrom(r).ID); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *App) adminListSources(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT s.id, s.name, s.url, s.feed_url, s.is_state, s.import_news, s.category, s.enabled, s.last_status, s.last_error, s.last_fetch_at, s.fetch_ok, s.fetch_total,
			(SELECT count(*) FROM source_items i WHERE i.source_id = s.id AND i.published_at > now() - interval '7 days')
		FROM news_sources s ORDER BY s.is_state DESC, s.name`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	list := []Source{}
	for rows.Next() {
		var s Source
		if err := rows.Scan(&s.ID, &s.Name, &s.URL, &s.FeedURL, &s.IsState, &s.ImportNews, &s.Category, &s.Enabled, &s.LastStatus, &s.LastError, &s.LastFetch, &s.FetchOK, &s.FetchTotal, &s.Posts7d); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		list = append(list, s)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func decodeSource(w http.ResponseWriter, r *http.Request) (*Source, bool) {
	var s Source
	if err := readJSON(r, &s); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return nil, false
	}
	s.Name = strings.TrimSpace(s.Name)
	s.Category = strings.TrimSpace(s.Category)
	s.FeedURL = safeURL(s.FeedURL)
	s.URL = safeURL(s.URL)
	if s.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return nil, false
	}
	if s.FeedURL == "" {
		writeError(w, http.StatusBadRequest, "feed_url must be an http(s) address")
		return nil, false
	}
	if s.URL == "" {
		u, _ := url.Parse(s.FeedURL)
		s.URL = u.Scheme + "://" + u.Host + "/"
	}
	return &s, true
}

func writeSourceError(w http.ResponseWriter, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		writeError(w, http.StatusConflict, "Канал с такой лентой уже есть")
		return
	}
	writeError(w, http.StatusInternalServerError, "db error")
}

func (a *App) createSource(w http.ResponseWriter, r *http.Request) {
	s, ok := decodeSource(w, r)
	if !ok {
		return
	}
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO news_sources (name, url, feed_url, is_state, import_news, category, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		s.Name, s.URL, s.FeedURL, s.IsState, s.ImportNews, s.Category, s.Enabled).Scan(&s.ID)
	if err != nil {
		writeSourceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (a *App) updateSource(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	s, ok := decodeSource(w, r)
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE news_sources SET name=$1, url=$2, feed_url=$3, is_state=$4, import_news=$5, category=$6, enabled=$7 WHERE id=$8`,
		s.Name, s.URL, s.FeedURL, s.IsState, s.ImportNews, s.Category, s.Enabled, id)
	if err != nil {
		writeSourceError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	s.ID = id
	writeJSON(w, http.StatusOK, s)
}

// deleteSource removes the channel with its history and votes; news it already published stay.
func (a *App) deleteSource(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := a.db.Exec(r.Context(), `DELETE FROM news_sources WHERE id = $1`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// refreshSources starts a poll in the background: it can outlast the nginx proxy timeout.
func (a *App) refreshSources(w http.ResponseWriter, r *http.Request) {
	go a.syncSources(context.Background())
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
}
