package main

import (
	"fmt"
	"net/http"
	"slices"
	"time"
)

// submitSurvey stores one anonymous survey response. No account is needed and
// nothing about the respondent is saved, only the chosen options and the UI language.
func (a *App) submitSurvey(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var in struct {
		Answers [][]int `json:"answers"`
		Lang    string  `json:"lang"`
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
	if t.Kind != kindSurvey {
		writeError(w, http.StatusBadRequest, "not a survey")
		return
	}
	if len(in.Answers) != len(t.Questions) {
		writeError(w, http.StatusBadRequest, "one answer list per question is required")
		return
	}
	for i, q := range t.Questions {
		ans := in.Answers[i]
		slices.Sort(ans)
		ans = slices.Compact(ans)
		in.Answers[i] = ans
		if len(ans) == 0 && !q.Optional {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d needs an answer", i+1))
			return
		}
		if len(ans) > 1 && !q.Multiple {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d takes one answer", i+1))
			return
		}
		for _, o := range ans {
			if o < 0 || o >= len(q.Options) {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d: unknown option", i+1))
				return
			}
		}
	}
	lang := "ru"
	if in.Lang == "ky" {
		lang = "ky"
	}
	if _, err := a.db.Exec(r.Context(), `INSERT INTO survey_responses (test_id, answers, lang) VALUES ($1, $2, $3)`, t.ID, in.Answers, lang); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

type surveyQuestionStats struct {
	Text     string   `json:"text"`
	TextKY   string   `json:"text_ky"`
	Options  []string `json:"options"`
	Multiple bool     `json:"multiple"`
	Optional bool     `json:"optional"`
	Counts   []int    `json:"counts"`   // how many respondents picked each option
	Answered int      `json:"answered"` // respondents who answered this question at all
}

// adminSurvey aggregates the answers to one survey, option by option.
func (a *App) adminSurvey(w http.ResponseWriter, r *http.Request) {
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

	qs := make([]surveyQuestionStats, len(t.Questions))
	for i, q := range t.Questions {
		qs[i] = surveyQuestionStats{Text: q.Text, Options: q.Options, Multiple: q.Multiple, Optional: q.Optional, Counts: make([]int, len(q.Options))}
		if i < len(t.KY.Questions) {
			qs[i].TextKY = t.KY.Questions[i].Text
		}
	}

	rows, err := a.db.Query(r.Context(), `SELECT answers, lang, created_at FROM survey_responses WHERE test_id = $1 ORDER BY created_at`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	var (
		total  int
		byLang = map[string]int{"ru": 0, "ky": 0}
		lastAt *time.Time
	)
	for rows.Next() {
		var (
			answers [][]int
			lang    string
			at      time.Time
		)
		if err := rows.Scan(&answers, &lang, &at); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		total++
		byLang[lang]++
		lastAt = &at
		// Answers are matched by position; options added or removed after the
		// response was saved are skipped rather than miscounted.
		for i, ans := range answers {
			if i >= len(qs) {
				break
			}
			counted := false
			for _, o := range ans {
				if o >= 0 && o < len(qs[i].Counts) {
					qs[i].Counts[o]++
					counted = true
				}
			}
			if counted {
				qs[i].Answered++
			}
		}
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": t.ID, "title": t.Title, "title_ky": t.KY.Title, "published": t.Published,
		"responses": total, "by_lang": byLang, "last_at": lastAt, "questions": qs,
	})
}

// adminClearSurvey deletes all responses to a survey (e.g. after a test run).
func (a *App) adminClearSurvey(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := a.db.Exec(r.Context(), `DELETE FROM survey_responses WHERE test_id = $1`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
