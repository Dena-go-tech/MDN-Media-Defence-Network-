package main

import (
	"net/http"
	"strings"
)

// Content is stored in Russian with an optional Kyrgyz translation next to it.
// Public endpoints take ?lang=ky and return the translation where it exists.

func reqLang(r *http.Request) string {
	if r.URL.Query().Get("lang") == "ky" {
		return "ky"
	}
	return "ru"
}

// pick returns the translation when it is filled in, otherwise the original.
func pick(tr, orig string) string {
	if strings.TrimSpace(tr) != "" {
		return tr
	}
	return orig
}

// NewsText is the Kyrgyz version of an article.
type NewsText struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
	Body    string `json:"body"`
}

// QuestionText is the Kyrgyz version of one question; options line up with the original.
type QuestionText struct {
	Text    string   `json:"text"`
	Options []string `json:"options"`
}

// TestText is the Kyrgyz version of a test or survey.
type TestText struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Questions   []QuestionText `json:"questions"`
}

// localize swaps in the Kyrgyz text and drops the translation block from the public payload.
func (n *News) localize(lang string) {
	if lang == "ky" {
		n.Title = pick(n.KY.Title, n.Title)
		n.Summary = pick(n.KY.Summary, n.Summary)
		n.Body = pick(n.KY.Body, n.Body)
	}
	n.KY = NewsText{}
}

func (t *Test) localize(lang string) {
	if lang == "ky" {
		t.Title = pick(t.KY.Title, t.Title)
		t.Description = pick(t.KY.Description, t.Description)
		for i := range t.Questions {
			if i >= len(t.KY.Questions) {
				break
			}
			tr := t.KY.Questions[i]
			t.Questions[i].Text = pick(tr.Text, t.Questions[i].Text)
			opts := append([]string(nil), t.Questions[i].Options...)
			for j := range opts {
				if j < len(tr.Options) {
					opts[j] = pick(tr.Options[j], opts[j])
				}
			}
			t.Questions[i].Options = opts
		}
	}
	t.KY = TestText{}
}

func trimTestText(tt *TestText, questions int) {
	tt.Title = strings.TrimSpace(tt.Title)
	tt.Description = strings.TrimSpace(tt.Description)
	if len(tt.Questions) > questions {
		tt.Questions = tt.Questions[:questions]
	}
	if tt.Questions == nil {
		tt.Questions = []QuestionText{}
	}
}
