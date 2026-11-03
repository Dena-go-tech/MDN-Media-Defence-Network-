package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// defaultAssistantPrompt is written to the database on first start; after that
// the prompt is edited in the admin panel (Админка → Ассистент).
const defaultAssistantPrompt = `Ты BulbAI, помощник платформы Media Defence Network of Kyrgyzstan. Ты помогаешь журналистам и обычным читателям проверять информацию: новости, сообщения из мессенджеров, цитаты, фото-подписи, ссылки, а также разбираться в медиаправе и цифровой безопасности.

Как работать:
- Если вопрос касается тем, о которых есть материалы на сайте, опирайся в первую очередь на них и предложи прочитать материал или пройти тест.
- Если пользователь прислал утверждение или новость, проверь её через веб-поиск. Опирайся на первоисточники и надёжные СМИ, называй их.
- Отвечай кратко и по делу, на языке пользователя (русский, кыргызский или английский; другие языки не используй). Без длинных вступлений.
- Пиши простым текстом без Markdown: без звёздочек, решёток и таблиц. Абзацы разделяй пустой строкой. Внешние ссылки давай полным URL. На материалы сайта ссылайся их путём (например /news/12 или /tests/3): на сайте путь сам превращается в кликабельное название.
- Объясни, почему ты пришёл к выводу, и дай 1-3 совета, как читателю проверить подобное самому.
- Если данных мало, честно скажи, что подтвердить не удалось.
- Если пользователь разбирает ошибки в тесте, объясни, почему верный ответ верный. Не выдавай готовые ответы на тест, который человек ещё не прошёл: лучше подскажи, что почитать.`

// verdictInstructions is always appended to the admin prompt: the frontend parses this tag,
// so it must not be editable.
const verdictInstructions = `В самом конце ответа, отдельной последней строкой, поставь ровно одну метку вердикта:
[[VERDICT:verified]] — утверждение подтверждено;
[[VERDICT:fake]] — утверждение ложно или это манипуляция;
[[VERDICT:doubt]] — недостаточно данных, сомнительно;
[[VERDICT:warning]] — мошенничество, фишинг или опасность для читателя;
[[VERDICT:none]] — вопрос не про проверку факта.
Метку не объясняй и не упоминай в тексте.`

// imageLine matches a body line that holds only an image URL (inline pictures in articles);
// such lines are dropped from the AI context.
var imageLine = regexp.MustCompile(`(?mi)^\s*(/uploads/\S+|https?://\S+\.(jpe?g|png|webp|gif)(\?\S*)?)\s*$\n?`)

const (
	contextNewsLimit   = 40   // latest published news put into the AI context
	contextNewsBodyMax = 1500 // characters of each article body
)

type AssistantSettings struct {
	SystemPrompt string    `json:"system_prompt"`
	SiteContext  bool      `json:"site_context"`
	WebSearch    bool      `json:"web_search"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func seedSettings(ctx context.Context, a *App) error {
	_, err := a.db.Exec(ctx, `INSERT INTO assistant_settings (id, system_prompt) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`, defaultAssistantPrompt)
	return err
}

func (a *App) loadSettings(ctx context.Context) (AssistantSettings, error) {
	var s AssistantSettings
	err := a.db.QueryRow(ctx, `SELECT system_prompt, site_context, web_search, updated_at FROM assistant_settings WHERE id = 1`).
		Scan(&s.SystemPrompt, &s.SiteContext, &s.WebSearch, &s.UpdatedAt)
	return s, err
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

// siteContext renders published news and tests as a block for the system prompt. Imported
// news is left out: outside text must not reach the prompt or crowd out the site's own material.
func (a *App) siteContext(ctx context.Context) (text string, news, tests int, err error) {
	var b strings.Builder
	b.WriteString("Ниже материалы сайта Media Defence Network KG на текущий момент. Это твоя база знаний о содержимом платформы: Чтобы сослаться на материал, напиши его путь из атрибута path (например /news/12 или /tests/3): на сайте путь автоматически заменяется кликабельным названием материала. Поэтому не пиши название рядом с путём и не бери его в кавычки, иначе оно повторится дважды. Если пользователь просит ссылку на материал, дай именно путь. Не придумывай пути, которых нет в списке. Если ответа в материалах нет, так и скажи или используй другие источники.\n\n")

	rows, err := a.db.Query(ctx, `
		SELECT id, title, ky->>'title', category, summary, body, created_at FROM news
		WHERE published AND source_url = '' ORDER BY featured DESC, created_at DESC LIMIT $1`, contextNewsLimit)
	if err != nil {
		return "", 0, 0, err
	}
	for rows.Next() {
		var (
			id                        int64
			title, cat, summary, body string
			titleKY                   *string
			created                   time.Time
		)
		if err := rows.Scan(&id, &title, &titleKY, &cat, &summary, &body, &created); err != nil {
			rows.Close()
			return "", 0, 0, err
		}
		news++
		fmt.Fprintf(&b, "<news path=\"/news/%d\" category=%q date=\"%s\">\nЗаголовок: %s\n", id, cat, created.Format("2006-01-02"), title)
		if titleKY != nil && *titleKY != "" {
			fmt.Fprintf(&b, "Заголовок на кыргызском: %s\n", *titleKY)
		}
		if summary != "" {
			fmt.Fprintf(&b, "Кратко: %s\n", summary)
		}
		fmt.Fprintf(&b, "Текст: %s\n</news>\n\n", truncate(imageLine.ReplaceAllString(body, ""), contextNewsBodyMax))
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return "", 0, 0, err
	}

	rows, err = a.db.Query(ctx, `SELECT id, title, level, description, questions FROM tests WHERE published AND kind = 'quiz' ORDER BY id`)
	if err != nil {
		return "", 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id                 int64
			title, level, desc string
			raw                []byte
			qs                 []Question
		)
		if err := rows.Scan(&id, &title, &level, &desc, &raw); err != nil {
			return "", 0, 0, err
		}
		_ = json.Unmarshal(raw, &qs)
		tests++
		fmt.Fprintf(&b, "<test path=\"/tests/%d\" level=%q>\nНазвание: %s\nОписание: %s\nВопросы:\n", id, level, title, desc)
		for i, q := range qs {
			fmt.Fprintf(&b, "%d. %s\n", i+1, q.Text)
			for j, o := range q.Options {
				mark := ""
				if j == q.Correct {
					mark = " (верный)"
				}
				fmt.Fprintf(&b, "   - %s%s\n", o, mark)
			}
		}
		b.WriteString("</test>\n\n")
	}
	return b.String(), news, tests, rows.Err()
}

func (a *App) adminGetSettings(w http.ResponseWriter, r *http.Request) {
	s, err := a.loadSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	ctxText, news, tests, err := a.siteContext(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"settings":       s,
		"default_prompt": defaultAssistantPrompt,
		"verdict_format": verdictInstructions,
		"model":          a.claudeModel,
		"ai_enabled":     a.claude != nil,
		"context":        map[string]int{"news": news, "tests": tests, "chars": len([]rune(ctxText))},
	})
}

func (a *App) adminUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var s AssistantSettings
	if err := readJSON(r, &s); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	s.SystemPrompt = strings.TrimSpace(s.SystemPrompt)
	if s.SystemPrompt == "" {
		writeError(w, http.StatusBadRequest, "prompt must not be empty")
		return
	}
	if len([]rune(s.SystemPrompt)) > 20000 {
		writeError(w, http.StatusBadRequest, "prompt is too long (max 20000 characters)")
		return
	}
	err := a.db.QueryRow(r.Context(), `
		UPDATE assistant_settings SET system_prompt = $1, site_context = $2, web_search = $3, updated_at = now()
		WHERE id = 1 RETURNING updated_at`, s.SystemPrompt, s.SiteContext, s.WebSearch).Scan(&s.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, s)
}
