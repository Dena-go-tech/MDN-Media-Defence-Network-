package main

import (
	"net/http"
	"strings"
	"time"
)

// Script is a prepared question/answer pair the assistant plays in demo mode,
// when no AI provider is configured.
type Script struct {
	ID        int64     `json:"id"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer"`
	Verdict   string    `json:"verdict"`
	Position  int       `json:"position"`
	Published bool      `json:"published"`
	CreatedAt time.Time `json:"created_at"`
}

var verdicts = map[string]bool{"verified": true, "fake": true, "doubt": true, "warning": true, "none": true}

const scriptCols = `id, question, answer, verdict, position, published, created_at`

func (a *App) queryScripts(r *http.Request, where string) ([]Script, error) {
	rows, err := a.db.Query(r.Context(), `SELECT `+scriptCols+` FROM assistant_scripts `+where+` ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Script{}
	for rows.Next() {
		var s Script
		if err := rows.Scan(&s.ID, &s.Question, &s.Answer, &s.Verdict, &s.Position, &s.Published, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (a *App) assistantStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ai": a.claude != nil})
}

func (a *App) listScripts(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryScripts(r, `WHERE published`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) adminListScripts(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryScripts(r, ``)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func decodeScript(w http.ResponseWriter, r *http.Request) (*Script, bool) {
	var s Script
	if err := readJSON(r, &s); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return nil, false
	}
	s.Question = strings.TrimSpace(s.Question)
	s.Answer = strings.TrimSpace(s.Answer)
	if s.Verdict == "" {
		s.Verdict = "none"
	}
	if s.Question == "" || s.Answer == "" || !verdicts[s.Verdict] {
		writeError(w, http.StatusBadRequest, "question, answer and a valid verdict are required")
		return nil, false
	}
	return &s, true
}

func (a *App) createScript(w http.ResponseWriter, r *http.Request) {
	s, ok := decodeScript(w, r)
	if !ok {
		return
	}
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO assistant_scripts (question, answer, verdict, position, published)
		VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
		s.Question, s.Answer, s.Verdict, s.Position, s.Published).Scan(&s.ID, &s.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (a *App) updateScript(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	s, ok := decodeScript(w, r)
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE assistant_scripts SET question=$1, answer=$2, verdict=$3, position=$4, published=$5 WHERE id=$6`,
		s.Question, s.Answer, s.Verdict, s.Position, s.Published, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	s.ID = id
	writeJSON(w, http.StatusOK, s)
}

func (a *App) deleteScript(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := a.db.Exec(r.Context(), `DELETE FROM assistant_scripts WHERE id = $1`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
