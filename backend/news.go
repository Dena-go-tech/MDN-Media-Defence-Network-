package main

import (
	"net/http"
	"strings"
	"time"
)

type News struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Summary   string    `json:"summary"`
	Body      string    `json:"body"`
	ImageURL  string    `json:"image_url"`
	Category  string    `json:"category"`
	Featured  bool      `json:"featured"`
	Published bool      `json:"published"`
	CreatedAt time.Time `json:"created_at"`
	KY        NewsText  `json:"ky,omitzero"` // Kyrgyz translation, admin only
}

const newsCols = `id, title, summary, body, image_url, category, featured, published, created_at, ky`

func (a *App) queryNews(r *http.Request, where string) ([]News, error) {
	rows, err := a.db.Query(r.Context(), `SELECT `+newsCols+` FROM news `+where+` ORDER BY featured DESC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []News{}
	for rows.Next() {
		var n News
		if err := rows.Scan(&n.ID, &n.Title, &n.Summary, &n.Body, &n.ImageURL, &n.Category, &n.Featured, &n.Published, &n.CreatedAt, &n.KY); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (a *App) listNews(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryNews(r, `WHERE published`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	lang := reqLang(r)
	for i := range list {
		list[i].localize(lang)
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) adminListNews(w http.ResponseWriter, r *http.Request) {
	list, err := a.queryNews(r, ``)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *App) getNews(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var n News
	err := a.db.QueryRow(r.Context(), `SELECT `+newsCols+` FROM news WHERE id = $1 AND published`, id).
		Scan(&n.ID, &n.Title, &n.Summary, &n.Body, &n.ImageURL, &n.Category, &n.Featured, &n.Published, &n.CreatedAt, &n.KY)
	if isNotFound(err) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	n.localize(reqLang(r))
	writeJSON(w, http.StatusOK, n)
}

func decodeNews(w http.ResponseWriter, r *http.Request) (*News, bool) {
	var n News
	if err := readJSON(r, &n); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return nil, false
	}
	n.Title = strings.TrimSpace(n.Title)
	n.Category = strings.TrimSpace(n.Category)
	n.KY.Title = strings.TrimSpace(n.KY.Title)
	n.KY.Summary = strings.TrimSpace(n.KY.Summary)
	n.KY.Body = strings.TrimSpace(n.KY.Body)
	if n.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return nil, false
	}
	return &n, true
}

func (a *App) createNews(w http.ResponseWriter, r *http.Request) {
	n, ok := decodeNews(w, r)
	if !ok {
		return
	}
	// An optional created_at lets imports keep the original publication date.
	var created *time.Time
	if !n.CreatedAt.IsZero() {
		created = &n.CreatedAt
	}
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO news (title, summary, body, image_url, category, featured, published, created_at, ky)
		VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9) RETURNING id, created_at`,
		n.Title, n.Summary, n.Body, n.ImageURL, n.Category, n.Featured, n.Published, created, n.KY).Scan(&n.ID, &n.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusCreated, n)
}

func (a *App) updateNews(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	n, ok := decodeNews(w, r)
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE news SET title=$1, summary=$2, body=$3, image_url=$4, category=$5, featured=$6, published=$7, ky=$8 WHERE id=$9`,
		n.Title, n.Summary, n.Body, n.ImageURL, n.Category, n.Featured, n.Published, n.KY, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	n.ID = id
	writeJSON(w, http.StatusOK, n)
}

func (a *App) deleteNews(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := a.db.Exec(r.Context(), `DELETE FROM news WHERE id = $1`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
