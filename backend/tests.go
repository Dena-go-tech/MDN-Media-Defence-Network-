package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Question struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
	Correct int      `json:"correct"`
}

// PublicQuestion is what a test taker sees: no correct answer.
type PublicQuestion struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
}

type Test struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Questions   []Question `json:"questions"`
	Published   bool       `json:"published"`
	CreatedAt   time.Time  `json:"created_at"`
}

type TestSummary struct {
	ID            int64     `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	QuestionCount int       `json:"question_count"`
	Published     bool      `json:"published"`
	CreatedAt     time.Time `json:"created_at"`
}

func (a *App) queryTestSummaries(r *http.Request, where string) ([]TestSummary, error) {
	rows, err := a.db.Query(r.Context(), `
		SELECT id, title, description, jsonb_array_length(questions), published, created_at
		FROM tests `+where+` ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []TestSummary{}
	for rows.Next() {
		var t TestSummary
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.QuestionCount, &t.Published, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (a *App) loadTest(r *http.Request, id int64, onlyPublished bool) (*Test, error) {
	q := `SELECT id, title, description, questions, published, created_at FROM tests WHERE id = $1`
	if onlyPublished {
		q += ` AND published`
	}
	var t Test
	err := a.db.QueryRow(r.Context(), q, id).Scan(&t.ID, &t.Title, &t.Description, &t.Questions, &t.Published, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (a *App) listTests(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryTestSummaries(r, `WHERE published`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) adminListTests(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryTestSummaries(r, ``)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) getTest(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	t, err := a.loadTest(r, id, true)
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	qs := make([]PublicQuestion, len(t.Questions))
	for i, q := range t.Questions {
		qs[i] = PublicQuestion{Text: q.Text, Options: q.Options}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": t.ID, "title": t.Title, "description": t.Description, "questions": qs,
	})
}

func (a *App) adminGetTest(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	t, err := a.loadTest(r, id, false)
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *App) submitTest(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var in struct {
		Answers []int `json:"answers"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	t, err := a.loadTest(r, id, true)
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	score := 0
	correct := make([]int, len(t.Questions))
	for i, q := range t.Questions {
		correct[i] = q.Correct
		if i < len(in.Answers) && in.Answers[i] == q.Correct {
			score++
		}
	}
	total := len(t.Questions)
	if _, err := a.db.Exec(r.Context(), `INSERT INTO results (user_id, test_id, score, total) VALUES ($1, $2, $3, $4)`,
		userFrom(r).ID, t.ID, score, total); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"score": score, "total": total, "correct": correct})
}

func (a *App) myResults(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `
		SELECT r.id, r.test_id, t.title, r.score, r.total, r.created_at
		FROM results r JOIN tests t ON t.id = r.test_id
		WHERE r.user_id = $1 ORDER BY r.created_at DESC`, userFrom(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	type result struct {
		ID        int64     `json:"id"`
		TestID    int64     `json:"test_id"`
		TestTitle string    `json:"test_title"`
		Score     int       `json:"score"`
		Total     int       `json:"total"`
		CreatedAt time.Time `json:"created_at"`
	}
	list := []result{}
	for rows.Next() {
		var res result
		if err := rows.Scan(&res.ID, &res.TestID, &res.TestTitle, &res.Score, &res.Total, &res.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		list = append(list, res)
	}
	writeJSON(w, http.StatusOK, list)
}

func decodeTest(w http.ResponseWriter, r *http.Request) (*Test, bool) {
	var t Test
	if err := readJSON(r, &t); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return nil, false
	}
	t.Title = strings.TrimSpace(t.Title)
	if t.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return nil, false
	}
	if t.Questions == nil {
		t.Questions = []Question{}
	}
	for i, q := range t.Questions {
		if strings.TrimSpace(q.Text) == "" || len(q.Options) < 2 || q.Correct < 0 || q.Correct >= len(q.Options) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d: text, at least 2 options and a valid correct answer are required", i+1))
			return nil, false
		}
	}
	return &t, true
}

func (a *App) createTest(w http.ResponseWriter, r *http.Request) {
	t, ok := decodeTest(w, r)
	if !ok {
		return
	}
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO tests (title, description, questions, published) VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`, t.Title, t.Description, t.Questions, t.Published).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (a *App) updateTest(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	t, ok := decodeTest(w, r)
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `UPDATE tests SET title=$1, description=$2, questions=$3, published=$4 WHERE id=$5`,
		t.Title, t.Description, t.Questions, t.Published, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	t.ID = id
	writeJSON(w, http.StatusOK, t)
}

func (a *App) deleteTest(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := a.db.Exec(r.Context(), `DELETE FROM tests WHERE id = $1`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
