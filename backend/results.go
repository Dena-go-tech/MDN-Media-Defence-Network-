package main

import (
	"encoding/json"
	"net/http"
	"time"
)

// AnswerDetail is a snapshot of one question at the moment the test was taken,
// so the breakdown stays correct even if the test is edited later.
type AnswerDetail struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
	Chosen  int      `json:"chosen"` // -1 when the question was left unanswered
	Correct int      `json:"correct"`
}

type ResultDetail struct {
	ID        int64          `json:"id"`
	TestID    int64          `json:"test_id"`
	TestTitle string         `json:"test_title"`
	UserID    int64          `json:"user_id"`
	UserName  string         `json:"user_name"`
	UserEmail string         `json:"user_email"`
	Score     int            `json:"score"`
	Total     int            `json:"total"`
	CreatedAt time.Time      `json:"created_at"`
	Details   []AnswerDetail `json:"details"`
}

func buildDetails(qs []Question, answers []int) []AnswerDetail {
	out := make([]AnswerDetail, len(qs))
	for i, q := range qs {
		chosen := -1
		if i < len(answers) && answers[i] >= 0 && answers[i] < len(q.Options) {
			chosen = answers[i]
		}
		out[i] = AnswerDetail{Text: q.Text, Options: q.Options, Chosen: chosen, Correct: q.Correct}
	}
	return out
}

// loadResult returns one result; ownerID > 0 restricts it to that user's results.
func (a *App) loadResult(r *http.Request, id, ownerID int64) (*ResultDetail, error) {
	q := `
		SELECT r.id, r.test_id, t.title, u.id, u.name, u.email, r.score, r.total, r.created_at, r.details
		FROM results r JOIN tests t ON t.id = r.test_id JOIN users u ON u.id = r.user_id
		WHERE r.id = $1 AND ($2 = 0 OR r.user_id = $2)`
	var d ResultDetail
	var raw []byte
	err := a.db.QueryRow(r.Context(), q, id, ownerID).Scan(&d.ID, &d.TestID, &d.TestTitle, &d.UserID, &d.UserName, &d.UserEmail, &d.Score, &d.Total, &d.CreatedAt, &raw)
	if err != nil {
		return nil, err
	}
	d.Details = []AnswerDetail{}
	_ = json.Unmarshal(raw, &d.Details)
	return &d, nil
}

func (a *App) writeResult(w http.ResponseWriter, r *http.Request, ownerID int64) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	d, err := a.loadResult(r, id, ownerID)
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (a *App) myResult(w http.ResponseWriter, r *http.Request) {
	a.writeResult(w, r, userFrom(r).ID)
}

func (a *App) adminResult(w http.ResponseWriter, r *http.Request) {
	a.writeResult(w, r, 0)
}

type studentSummary struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	Email     string     `json:"email"`
	Role      string     `json:"role"`
	CreatedAt time.Time  `json:"created_at"`
	Attempts  int        `json:"attempts"`
	AvgPct    int        `json:"avg_pct"`
	LastAt    *time.Time `json:"last_at"`
}

const studentCols = `
	u.id, u.name, u.email, u.role, u.created_at, count(r.id),
	COALESCE(round(avg(r.score * 100.0 / NULLIF(r.total, 0))), 0)::int, max(r.created_at)`

func scanStudent(row interface{ Scan(...any) error }) (studentSummary, error) {
	var s studentSummary
	err := row.Scan(&s.ID, &s.Name, &s.Email, &s.Role, &s.CreatedAt, &s.Attempts, &s.AvgPct, &s.LastAt)
	return s, err
}

func (a *App) adminStudents(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT `+studentCols+`
		FROM users u LEFT JOIN results r ON r.user_id = u.id
		GROUP BY u.id ORDER BY max(r.created_at) DESC NULLS LAST, u.created_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	list := []studentSummary{}
	for rows.Next() {
		s, err := scanStudent(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		list = append(list, s)
	}
	writeJSON(w, http.StatusOK, list)
}

type studentResult struct {
	ID        int64     `json:"id"`
	TestID    int64     `json:"test_id"`
	TestTitle string    `json:"test_title"`
	Score     int       `json:"score"`
	Total     int       `json:"total"`
	CreatedAt time.Time `json:"created_at"`
}

func (a *App) adminStudent(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	s, err := scanStudent(a.db.QueryRow(r.Context(), `
		SELECT `+studentCols+`
		FROM users u LEFT JOIN results r ON r.user_id = u.id
		WHERE u.id = $1 GROUP BY u.id`, id))
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	rows, err := a.db.Query(r.Context(), `
		SELECT r.id, r.test_id, t.title, r.score, r.total, r.created_at
		FROM results r JOIN tests t ON t.id = r.test_id
		WHERE r.user_id = $1 ORDER BY r.created_at DESC`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	results := []studentResult{}
	for rows.Next() {
		var res studentResult
		if err := rows.Scan(&res.ID, &res.TestID, &res.TestTitle, &res.Score, &res.Total, &res.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		results = append(results, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"student": s, "results": results})
}
