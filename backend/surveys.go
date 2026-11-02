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

	rows, err := a.db.Query(r.Context(), `SELECT answers, lang, source, created_at FROM survey_responses WHERE test_id = $1 ORDER BY created_at`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	var (
		total    int
		byLang   = map[string]int{"ru": 0, "ky": 0}
		bySource = map[string]int{"site": 0, "import": 0}
		lastAt   *time.Time
	)
	for rows.Next() {
		var (
			answers      [][]int
			lang, source string
			at           time.Time
		)
		if err := rows.Scan(&answers, &lang, &source, &at); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		total++
		byLang[lang]++
		bySource[source]++
		if source == "site" {
			lastAt = &at
		}
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
		"responses": total, "by_lang": byLang, "by_source": bySource, "last_at": lastAt, "questions": qs,
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

// adminImportSurvey loads responses collected outside the portal (e.g. the Google Form
// the survey started as). Unlike the public endpoint, a question may be left empty:
// an import often only has some of the questions. Earlier imports are replaced, so
// running the import again does not double the numbers; answers given on the site stay.
func (a *App) adminImportSurvey(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var in struct {
		Responses [][][]int `json:"responses"`
		Lang      string    `json:"lang"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
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
	if t.Kind != kindSurvey {
		writeError(w, http.StatusBadRequest, "not a survey")
		return
	}
	for n, answers := range in.Responses {
		if len(answers) != len(t.Questions) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("response %d: one answer list per question is required", n+1))
			return
		}
		for i, q := range t.Questions {
			ans := slices.Compact(slices.Sorted(slices.Values(answers[i])))
			answers[i] = ans
			if len(ans) > 1 && !q.Multiple {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("response %d, question %d takes one answer", n+1, i+1))
				return
			}
			for _, o := range ans {
				if o < 0 || o >= len(q.Options) {
					writeError(w, http.StatusBadRequest, fmt.Sprintf("response %d, question %d: unknown option", n+1, i+1))
					return
				}
			}
		}
	}
	lang := "ky"
	if in.Lang == "ru" {
		lang = "ru"
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tx.Rollback(r.Context())
	if _, err := tx.Exec(r.Context(), `DELETE FROM survey_responses WHERE test_id = $1 AND source = 'import'`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	for _, answers := range in.Responses {
		if _, err := tx.Exec(r.Context(), `INSERT INTO survey_responses (test_id, answers, lang, source) VALUES ($1, $2, $3, 'import')`, id, answers, lang); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"imported": len(in.Responses)})
}

// adminFillSurvey fills in questions left empty in existing responses, without deleting
// anything: for each question index it hands the given answers, in order, to the
// responses (oldest first, optionally only those in one language) where that question
// is still unanswered. Answers already given are never overwritten.
func (a *App) adminFillSurvey(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var in struct {
		Fill map[int][][]int `json:"fill"`
		Lang string          `json:"lang"` // "" = any language
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
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
	if t.Kind != kindSurvey {
		writeError(w, http.StatusBadRequest, "not a survey")
		return
	}
	for qi, list := range in.Fill {
		if qi < 0 || qi >= len(t.Questions) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("unknown question %d", qi+1))
			return
		}
		q := t.Questions[qi]
		for n, ans := range list {
			ans = slices.Compact(slices.Sorted(slices.Values(ans)))
			list[n] = ans
			if len(ans) == 0 || (len(ans) > 1 && !q.Multiple) {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d, answer %d: wrong number of options", qi+1, n+1))
				return
			}
			for _, o := range ans {
				if o < 0 || o >= len(q.Options) {
					writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d, answer %d: unknown option", qi+1, n+1))
					return
				}
			}
		}
	}

	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tx.Rollback(r.Context())
	rows, err := tx.Query(r.Context(), `
		SELECT id, answers FROM survey_responses
		WHERE test_id = $1 AND ($2 = '' OR lang = $2) ORDER BY id FOR UPDATE`, id, in.Lang)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	type resp struct {
		id      int64
		answers [][]int
	}
	var list []resp
	for rows.Next() {
		var x resp
		if err := rows.Scan(&x.id, &x.answers); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		for len(x.answers) < len(t.Questions) {
			x.answers = append(x.answers, []int{})
		}
		list = append(list, x)
	}
	rows.Close()

	filled := map[int]int{}
	changed := map[int]bool{}
	for qi, answers := range in.Fill {
		next := 0
		for i := range list {
			if next == len(answers) {
				break
			}
			if len(list[i].answers[qi]) == 0 {
				list[i].answers[qi] = answers[next]
				changed[i] = true
				next++
			}
		}
		if next < len(answers) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("question %d: %d answers given but only %d responses have it empty", qi+1, len(answers), next))
			return
		}
		filled[qi+1] = next
	}
	for i := range list {
		if !changed[i] {
			continue
		}
		if _, err := tx.Exec(r.Context(), `UPDATE survey_responses SET answers = $1 WHERE id = $2`, list[i].answers, list[i].id); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"filled": filled, "responses_updated": len(changed)})
}
