package main

import (
	"net/http"
	"time"
)

type testStat struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Attempts int    `json:"attempts"`
	AvgPct   int    `json:"avg_pct"`
}

type recentResult struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UserName  string    `json:"user_name"`
	TestTitle string    `json:"test_title"`
	Score     int       `json:"score"`
	Total     int       `json:"total"`
}

type stats struct {
	Attempts       int            `json:"attempts"`
	AvgPct         int            `json:"avg_pct"`
	Users          int            `json:"users"`
	PublishedTests int            `json:"published_tests"`
	Tests          []testStat     `json:"tests"`
	Recent         []recentResult `json:"recent"`
	HardQuestions  []hardQuestion `json:"hard_questions"`
}

// hardQuestion is a question that test takers most often get wrong.
type hardQuestion struct {
	TestID    int64  `json:"test_id"`
	TestTitle string `json:"test_title"`
	Question  string `json:"question"`
	Answers   int    `json:"answers"`
	Wrong     int    `json:"wrong"`
	WrongPct  int    `json:"wrong_pct"`
}

// adminStats aggregates test results for the admin analytics page.
func (a *App) adminStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s := stats{Tests: []testStat{}, Recent: []recentResult{}, HardQuestions: []hardQuestion{}}

	err := a.db.QueryRow(ctx, `
		SELECT count(*),
		       COALESCE(round(avg(score * 100.0 / NULLIF(total, 0))), 0)::int,
		       count(DISTINCT user_id),
		       (SELECT count(*) FROM tests WHERE published AND kind = 'quiz')
		FROM results`).Scan(&s.Attempts, &s.AvgPct, &s.Users, &s.PublishedTests)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	rows, err := a.db.Query(ctx, `
		SELECT t.id, t.title, count(r.id),
		       COALESCE(round(avg(r.score * 100.0 / NULLIF(r.total, 0))), 0)::int
		FROM tests t LEFT JOIN results r ON r.test_id = t.id
		WHERE t.kind = 'quiz'
		GROUP BY t.id ORDER BY count(r.id) DESC, t.title`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	for rows.Next() {
		var t testStat
		if err := rows.Scan(&t.ID, &t.Title, &t.Attempts, &t.AvgPct); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		s.Tests = append(s.Tests, t)
	}
	rows.Close()

	rows, err = a.db.Query(ctx, `
		SELECT r.id, u.id, r.created_at, u.name, t.title, r.score, r.total
		FROM results r JOIN users u ON u.id = r.user_id JOIN tests t ON t.id = r.test_id
		ORDER BY r.created_at DESC LIMIT 20`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var res recentResult
		if err := rows.Scan(&res.ID, &res.UserID, &res.CreatedAt, &res.UserName, &res.TestTitle, &res.Score, &res.Total); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		s.Recent = append(s.Recent, res)
	}
	rows.Close()

	// Per-question error rates from the answer snapshots stored with each result.
	rows, err = a.db.Query(ctx, `
		SELECT r.test_id, t.title, d->>'text', count(*),
		       count(*) FILTER (WHERE (d->>'chosen')::int <> (d->>'correct')::int)
		FROM results r JOIN tests t ON t.id = r.test_id
		CROSS JOIN LATERAL jsonb_array_elements(r.details) d
		GROUP BY r.test_id, t.title, d->>'text'
		HAVING count(*) FILTER (WHERE (d->>'chosen')::int <> (d->>'correct')::int) > 0
		ORDER BY count(*) FILTER (WHERE (d->>'chosen')::int <> (d->>'correct')::int) * 1.0 / count(*) DESC, count(*) DESC
		LIMIT 8`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var h hardQuestion
		if err := rows.Scan(&h.TestID, &h.TestTitle, &h.Question, &h.Answers, &h.Wrong); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		h.WrongPct = h.Wrong * 100 / h.Answers
		s.HardQuestions = append(s.HardQuestions, h)
	}

	writeJSON(w, http.StatusOK, s)
}
