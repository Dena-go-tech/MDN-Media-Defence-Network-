package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

const (
	minParagraphRunes = 4
	minTailRunes      = 20  // a shorter cut-off tail reads as a glitch, so it is dropped
	leadScrapRunes    = 60  // shorter unfinished lines before the text are not the text
	minPageRunes      = 200 // less than this in <article> is not the article's text
)

const (
	bodyShare        = 0.7 // part of an article's text republished; the rest stays at the source
	bodyLeadMaxRunes = 600 // feed text shorter than this is treated as a lead, not the article
	pageMaxAttempts  = 3
	pagesPerSync     = 100 // page fetches per poll, so a backlog is worked off gently
	pageFetchPause   = time.Second
	pageFetchTimeout = 20 * time.Second
)

// Containers that hold page furniture rather than the article's own text.
var skippedTags = map[atom.Atom]bool{
	atom.Script: true, atom.Style: true, atom.Noscript: true, atom.Iframe: true, atom.Svg: true,
	atom.Nav: true, atom.Aside: true, atom.Footer: true, atom.Header: true, atom.Form: true,
	atom.Button: true, atom.Figure: true, atom.Video: true, atom.Audio: true,
}

var blockTags = map[atom.Atom]bool{
	atom.P: true, atom.Div: true, atom.Li: true, atom.Ul: true, atom.Ol: true, atom.Blockquote: true,
	atom.H1: true, atom.H2: true, atom.H3: true, atom.H4: true, atom.H5: true, atom.H6: true,
	atom.Tr: true, atom.Table: true, atom.Section: true, atom.Article: true, atom.Br: true, atom.Hr: true,
}

// nodeParagraphs collects the text under n as paragraphs of plain text.
func nodeParagraphs(n *html.Node) []string {
	var out []string
	var cur strings.Builder
	flush := func() {
		line := strings.TrimSpace(spaces.ReplaceAllString(cur.String(), " "))
		cur.Reset()
		// The article page renders a line holding only a URL as a picture.
		isBareURL := !strings.Contains(line, " ") && (strings.HasPrefix(line, "http") || strings.HasPrefix(line, "/") || strings.Contains(line, "."))
		// Stray fragments such as "www" or a lone dash are never a paragraph.
		if len([]rune(line)) >= minParagraphRunes && !isBareURL {
			out = append(out, line)
		}
	}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			cur.WriteString(n.Data)
			return
		}
		if n.Type == html.ElementNode && skippedTags[n.DataAtom] {
			return
		}
		block := n.Type == html.ElementNode && blockTags[n.DataAtom]
		if block {
			flush()
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if block {
			flush()
		}
	}
	walk(n)
	flush()
	return out
}

// fragmentParagraphs reads an HTML fragment from a feed.
func fragmentParagraphs(fragment string) []string {
	doc, err := html.Parse(strings.NewReader(html.UnescapeString(fragment)))
	if err != nil {
		return nil
	}
	return nodeParagraphs(doc)
}

// articlePage is what an article's page offers beyond a feed entry.
type articlePage struct {
	Paragraphs []string
	Title      string
	IsArticle  bool // false for a section or a service page
	Summary    string
	Image      string
	Published  string
}

func parsePage(r io.Reader) (page articlePage) {
	doc, err := html.Parse(r)
	if err != nil {
		return page
	}
	meta := map[string]string{}
	var article *html.Node
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch {
			case n.DataAtom == atom.Article && article == nil:
				article = n
			case n.DataAtom == atom.Meta:
				readMeta(n, meta)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	container := article
	if container != nil {
		page.Paragraphs = nodeParagraphs(container)
	}
	// Many sites have no <article>, or keep only the title and date in it.
	if runeCount(page.Paragraphs) < minPageRunes {
		if container = densestBlock(doc); container != nil {
			page.Paragraphs = nodeParagraphs(container)
		}
	}
	page.Title = cleanText(meta["og:title"])
	page.IsArticle = meta["og:type"] == "article" || meta["article:published_time"] != ""
	page.Summary = truncateRunes(cleanText(meta["og:description"]), summaryMaxRunes)
	page.Published = meta["article:published_time"]
	// Sites fall back to a logo when an article has no illustration of its own.
	if image := meta["og:image"]; !strings.Contains(strings.ToLower(image), "logo") {
		page.Image = safeURL(image)
	}
	if page.Image == "" && container != nil {
		page.Image = firstImage(container)
	}
	return page
}

func runeCount(paragraphs []string) int {
	n := 0
	for _, p := range paragraphs {
		n += len([]rune(p))
	}
	return n
}

// densestBlock finds the element whose own <p> children hold the most text, which on a
// news page is the article rather than the menus or the lists of other headlines.
func densestBlock(root *html.Node) *html.Node {
	var best *html.Node
	bestSize := 0
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && skippedTags[n.DataAtom] {
			return
		}
		size := 0
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if c.Type == html.ElementNode && c.DataAtom == atom.P {
				size += runeCount(nodeParagraphs(c))
			}
		}
		if size > bestSize {
			best, bestSize = n, size
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)
	return best
}

func firstImage(n *html.Node) string {
	if n.Type == html.ElementNode && n.DataAtom == atom.Img {
		for _, attr := range n.Attr {
			if attr.Key == "src" && !strings.Contains(strings.ToLower(attr.Val), "logo") {
				if u := safeURL(attr.Val); u != "" {
					return u
				}
			}
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if u := firstImage(c); u != "" {
			return u
		}
	}
	return ""
}

func readMeta(n *html.Node, into map[string]string) {
	var property, content string
	for _, attr := range n.Attr {
		switch attr.Key {
		case "property":
			property = attr.Val
		case "content":
			content = attr.Val
		}
	}
	if _, seen := into[property]; property != "" && !seen {
		into[property] = content
	}
}

// Share buttons and subscription prompts that come out as text.
var boilerplate = map[string]bool{
	"facebook": true, "twitter": true, "telegram": true, "whatsapp": true, "instagram": true, "youtube": true,
	"tiktok": true, "вконтакте": true, "одноклассники": true, "поделиться": true, "поделиться:": true, "читайте также": true,
}

func isBoilerplate(line string) bool {
	lower := strings.ToLower(line)
	return boilerplate[lower] || (len([]rune(line)) < 60 && (strings.Contains(lower, "telegram") || strings.Contains(lower, "whatsapp")))
}

// body returns the excerpt, cleared of the title that pages repeat in the text, of share
// buttons, and of the rubrics, dates and photo captions that come before the first sentence.
func (p articlePage) body() string {
	var text []string
	for _, line := range p.Paragraphs {
		if line == p.Title || isBoilerplate(line) {
			continue
		}
		short := len([]rune(line)) < leadScrapRunes && !strings.ContainsAny(line[len(line)-1:], ".!?")
		if len(text) == 0 && short {
			continue
		}
		text = append(text, line)
	}
	if runeCount(text) < minPageRunes {
		return ""
	}
	return excerpt(text)
}

// excerpt returns about bodyShare of the text, ending on a sentence where possible.
// Paragraphs stay separate lines, which is how the article page splits them.
func excerpt(paragraphs []string) string {
	total := 0
	for _, p := range paragraphs {
		total += len([]rune(p))
	}
	if total == 0 {
		return ""
	}
	budget := int(float64(total) * bodyShare)
	var kept []string
	for _, p := range paragraphs {
		r := []rune(p)
		if len(r) <= budget {
			kept = append(kept, p)
			budget -= len(r)
			continue
		}
		if cut := cutAtBoundary(r, budget); len([]rune(cut)) >= minTailRunes {
			kept = append(kept, cut)
		}
		break
	}
	return strings.Join(kept, "\n") + "…"
}

// cutAtBoundary shortens r to at most n runes, at a sentence end or else at a word end.
func cutAtBoundary(r []rune, n int) string {
	if n <= 0 {
		return ""
	}
	if n > len(r) {
		n = len(r)
	}
	word := 0
	for i := n - 1; i > 0; i-- {
		switch r[i] {
		case '.', '!', '?':
			return string(r[:i+1])
		case ' ':
			if word == 0 {
				word = i
			}
		}
	}
	return strings.TrimSpace(string(r[:word]))
}

// feedBody returns the excerpt when the feed carries the article itself. A lead (short, or
// cut off by the feed) returns "" and the text is taken from the article page instead.
func feedBody(text string) string {
	paragraphs := fragmentParagraphs(text)
	joined := strings.Join(paragraphs, " ")
	if len([]rune(joined)) < bodyLeadMaxRunes || strings.HasSuffix(joined, "…") || strings.HasSuffix(joined, "...") || strings.HasSuffix(joined, "[…]") {
		return ""
	}
	return excerpt(paragraphs)
}

func fetchArticlePage(ctx context.Context, link string) (articlePage, error) {
	u, err := url.Parse(link)
	if err != nil {
		return articlePage{}, err
	}
	if err := checkRobots(ctx, u); err != nil {
		return articlePage{}, err
	}
	res, err := botRequest(ctx, link)
	if err != nil {
		return articlePage{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return articlePage{}, errors.New(res.Status)
	}
	return parsePage(io.LimitReader(res.Body, maxFeedBytes)), nil
}

// fillFromPages completes imported news whose feed lacked the text or the picture. A page
// that loaded is final, as it has nothing more to give; a failed one gets a few attempts,
// so a broken page is not fetched on every poll forever.
func (a *App) fillFromPages(ctx context.Context) {
	rows, err := a.db.Query(ctx, `
		SELECT n.id, n.source_url FROM news n
		JOIN news_sources s ON s.name = n.source_name AND s.enabled AND s.import_news
		WHERE n.source_url <> '' AND (n.body = '' OR n.image_url = '') AND n.body_attempts < $1
		ORDER BY n.created_at DESC LIMIT $2`, pageMaxAttempts, pagesPerSync)
	if err != nil {
		log.Printf("sources: pages: %v", err)
		return
	}
	type pending struct {
		id   int64
		link string
	}
	var list []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.link); err != nil {
			rows.Close()
			log.Printf("sources: pages: %v", err)
			return
		}
		list = append(list, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		log.Printf("sources: pages: %v", err)
		return
	}

	for i, p := range list {
		if i > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(pageFetchPause):
			}
		}
		fetchCtx, cancel := context.WithTimeout(ctx, pageFetchTimeout)
		page, err := fetchArticlePage(fetchCtx, p.link)
		cancel()
		attempts := pageMaxAttempts
		if err != nil {
			log.Printf("sources: %s: %v", p.link, err)
			attempts = 0 // only the increment below counts
		}
		// Filled fields stay: an editor may have written them during the fetch.
		if _, err := a.db.Exec(ctx, `
			UPDATE news SET body = CASE WHEN body = '' THEN $2 ELSE body END,
				image_url = CASE WHEN image_url = '' THEN $3 ELSE image_url END,
				body_attempts = GREATEST(body_attempts + 1, $4) WHERE id = $1`, p.id, page.body(), page.Image, attempts); err != nil {
			log.Printf("sources: pages: %v", err)
		}
	}
}
