package main

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestParseRSS(t *testing.T) {
	items, err := parseFeed(strings.NewReader(`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<title>Feed</title><link>https://x.kg/</link>
<item><title><![CDATA[Заголовок &amp; <b>жирный</b>]]></title><link>https://x.kg/a</link>
<description><![CDATA[<p>Первый&nbsp;абзац</p><script>alert(1)</script>]]></description>
<pubDate>Tue, 03 Nov 2020 07:06:46 +0000</pubDate><guid>a-1</guid>
<enclosure type="image/jpeg" url="https://x.kg/a.jpg"/></item>
<item><title>Без даты</title><link>https://x.kg/b</link><media:thumbnail url="https://x.kg/b.jpg"/></item>
<item><title>Опасная ссылка</title><link>javascript:alert(1)</link></item>
<item><title>Будущее</title><link>https://x.kg/c</link><pubDate>Tue, 03 Nov 2099 07:06:46 +0000</pubDate></item>
</channel></rss>`))
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 {
		t.Fatalf("want 3 items (javascript: link dropped), got %d", len(items))
	}
	a := items[0]
	if a.Title != "Заголовок & жирный" || a.GUID != "a-1" || a.Image != "https://x.kg/a.jpg" {
		t.Errorf("unexpected item: %+v", a)
	}
	if strings.Contains(a.Summary, "<") || !strings.HasPrefix(a.Summary, "Первый") {
		t.Errorf("summary not cleaned: %q", a.Summary)
	}
	if !a.Published.Equal(time.Date(2020, 11, 3, 7, 6, 46, 0, time.UTC)) {
		t.Errorf("date: %v", a.Published)
	}
	if items[1].GUID != "https://x.kg/b" || items[1].Image != "https://x.kg/b.jpg" || !items[1].Published.IsZero() {
		t.Errorf("fallbacks: %+v", items[1])
	}
	if items[2].Published.After(time.Now()) {
		t.Errorf("future date kept: %v", items[2].Published)
	}
}

func TestParseAtom(t *testing.T) {
	items, err := parseFeed(strings.NewReader(`<feed xmlns="http://www.w3.org/2005/Atom"><title>F</title>
<entry><id>tag:1</id><title>Atom</title><link rel="self" href="https://x.kg/self"/><link href="https://x.kg/e"/>
<summary>Text</summary><published>2020-01-02T03:04:05Z</published></entry></feed>`))
	if err != nil {
		t.Fatal(err)
	}
	it := items[0]
	if it.Link != "https://x.kg/e" || it.GUID != "tag:1" || it.Summary != "Text" || it.Published.Year() != 2020 {
		t.Errorf("unexpected item: %+v", it)
	}
}

func TestParseFeedRejectsNonFeed(t *testing.T) {
	if _, err := parseFeed(strings.NewReader(`<html><body><h1>Главная</h1></body></html>`)); err == nil {
		t.Error("an HTML page must not count as a working feed")
	}
}

func TestRobotsAllowed(t *testing.T) {
	ktrk := "User-agent: *\nDisallow: /wp-admin/\nDisallow: */feed\nDisallow: */rss\nAllow: /wp-content/uploads/\n\nUser-agent: Googlebot\nAllow: /*/*.js\n"
	cases := []struct {
		name, body, target string
		want               bool
	}{
		{"wildcard blocks feed", ktrk, "/feed/", false},
		{"other paths open", ktrk, "/news/1", true},
		{"other agent's rules ignored", "User-agent: Googlebot\nDisallow: /\n", "/rss", true},
		{"own group wins over star", "User-agent: *\nDisallow: /\n\nUser-agent: MDNKG-NewsBot\nAllow: /rss\n", "/rss", true},
		{"shared group", "User-agent: a\nUser-agent: *\nDisallow: /x\n", "/x/y", false},
		{"longest match wins", "User-agent: *\nDisallow: /a\nAllow: /a/feed\n", "/a/feed", true},
		{"query string rule", "User-agent: *\nDisallow: /*?\n", "/?rss", false},
		{"end anchor", "User-agent: *\nDisallow: /a$\n", "/a/b", true},
		{"empty disallow", "User-agent: *\nDisallow:\n", "/rss", true},
		{"empty file", "", "/rss", true},
	}
	for _, c := range cases {
		if got := robotsAllowed(c.body, botName, c.target); got != c.want {
			t.Errorf("%s: got %v", c.name, got)
		}
	}
}

func TestActivityScore(t *testing.T) {
	now := time.Now()
	ago := func(h float64) *time.Time { v := now.Add(-time.Duration(h * float64(time.Hour))); return &v }
	cases := []struct {
		name    string
		posts   int
		last    *time.Time
		ok, tot int
		want    int
	}{
		{"maximum", 140, ago(1), 10, 10, 100},
		{"volume is capped", 5000, ago(1), 10, 10, 100},
		{"half volume", 70, ago(1), 10, 10, 75},
		{"stale", 140, ago(100), 10, 10, 70},
		{"half availability", 140, ago(1), 5, 10, 90},
		{"nothing measured", 0, nil, 0, 0, 0},
	}
	for _, c := range cases {
		if got := activityScore(c.posts, c.last, c.ok, c.tot, now); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestRankRows(t *testing.T) {
	rows := []RatingRow{
		{Name: "active", Activity: 90},
		{Name: "b", Votes: 2},
		{Name: "a", Votes: 2},
		{Name: "top", Votes: 5},
		{Name: "quiet"},
	}
	rankRows(rows)
	want := []string{"top", "a", "b", "active", "quiet"}
	for i, n := range want {
		if rows[i].Name != n || rows[i].Rank != i+1 {
			t.Fatalf("order: %+v", rows)
		}
	}
}

func TestExcerpt(t *testing.T) {
	// 100 runes in four sentences of 25: 70 fall inside the third, so it is cut to the second.
	sentence := strings.Repeat("а", 24) + "."
	got := excerpt([]string{sentence + " " + sentence[1:] + " " + sentence[1:] + " " + sentence[1:]})
	if n := len([]rune(got)); n > 71 || n < 40 || !strings.HasSuffix(got, ".…") {
		t.Errorf("got %d runes: %q", n, got)
	}
	// Whole paragraphs are kept and stay separate lines.
	got = excerpt([]string{strings.Repeat("а", 50), strings.Repeat("б", 20), strings.Repeat("в", 30)})
	if got != strings.Repeat("а", 50)+"\n"+strings.Repeat("б", 20)+"…" {
		t.Errorf("got %q", got)
	}
	// No sentence end: falls back to a word boundary.
	got = excerpt([]string{"один два три четыре пять шесть семь восемь девять десять"})
	if !strings.HasSuffix(got, "…") || strings.HasSuffix(got, " …") || len([]rune(got)) > 41 {
		t.Errorf("got %q", got)
	}
	// A cut that leaves only a scrap is dropped rather than ending the text on it.
	got = excerpt([]string{strings.Repeat("а", 69), "- " + strings.Repeat("б", 30)})
	if got != strings.Repeat("а", 69)+"…" {
		t.Errorf("got %q", got)
	}
	if excerpt(nil) != "" {
		t.Error("empty text must stay empty")
	}
}

func TestFeedBody(t *testing.T) {
	long := strings.Repeat("Обычное предложение текста. ", 40)
	if got := feedBody("<p>" + long + "</p><script>x()</script><p>https://x.kg/a.jpg</p>"); got == "" || strings.Contains(got, "x()") || strings.Contains(got, "http") {
		t.Errorf("article in feed: %q", got)
	}
	if feedBody("Короткий анонс.") != "" {
		t.Error("a short text is a lead")
	}
	if feedBody(long+"и далее…") != "" {
		t.Error("text cut off by the feed is a lead")
	}
}

func TestParsePage(t *testing.T) {
	page := parsePage(strings.NewReader(`<html><head><meta property="og:image" content="https://x.kg/pic.webp"><meta property="og:title" content="Заголовок &amp; ещё">
<meta property="og:description" content="Анонс"><meta property="article:published_time" content="2026-11-03T10:00:00+06:00"></head>
<body><nav>Меню</nav><article><figure><figcaption>Фото</figcaption></figure>
<p>www</p><p>Первый <b>абзац</b>.</p><aside>Реклама</aside><div>Второй<br>Третий</div></article><footer>Подвал</footer></body></html>`))
	if strings.Join(page.Paragraphs, "|") != "Первый абзац.|Второй|Третий" {
		t.Errorf("paragraphs: %q", page.Paragraphs)
	}
	if page.Image != "https://x.kg/pic.webp" || page.Title != "Заголовок & ещё" || page.Summary != "Анонс" || page.Published != "2026-11-03T10:00:00+06:00" {
		t.Errorf("meta: %+v", page)
	}
	if page.body() != "" {
		t.Error("a few words in <article> are not the text")
	}
	page = parsePage(strings.NewReader(`<html><head><meta property="og:image" content="https://x.kg/uploads/soros-logo-hor.png"></head><body><p>Только меню</p></body></html>`))
	if page.body() != "" {
		t.Error("a line of menu is not an article")
	}
	if page.Image != "" {
		t.Errorf("a logo is not a news picture: %q", page.Image)
	}
}

func TestSitemapDocuments(t *testing.T) {
	index, err := decodeFeed(strings.NewReader(`<sitemapindex><sitemap><loc>https://x.kg/old.xml</loc><lastmod>2020-01-01T00:00:00Z</lastmod></sitemap>
<sitemap><loc>https://x.kg/new.xml</loc><lastmod>2026-01-01T00:00:00+06:00</lastmod></sitemap><sitemap><loc>https://x.kg/undated.xml</loc></sitemap></sitemapindex>`))
	if err != nil {
		t.Fatal(err)
	}
	if got := newestEntries(index.Sitemaps); got[0].Loc != "https://x.kg/new.xml" || got[2].Loc != "https://x.kg/undated.xml" {
		t.Errorf("order: %+v", got)
	}
	pages, err := decodeFeed(strings.NewReader(`<urlset><url><loc>https://x.kg/a</loc><lastmod>2026-01-01</lastmod><image:image><image:loc>https://x.kg/i.png</image:loc></image:image></url></urlset>`))
	if err != nil {
		t.Fatal(err)
	}
	if len(pages.URLs) != 1 || pages.URLs[0].Loc != "https://x.kg/a" {
		t.Errorf("urls: %+v", pages.URLs)
	}
}

func TestPageItem(t *testing.T) {
	entry := sitemapEntry{Loc: "https://x.kg/a", LastMod: "2026-01-02"}
	it := pageItem(entry, articlePage{IsArticle: true, Title: "T", Published: "2026-01-01T00:00:00Z"})
	if it.GUID != entry.Loc || it.Link != entry.Loc || it.Published.Day() != 1 {
		t.Errorf("published date first: %+v", it)
	}
	if it = pageItem(entry, articlePage{IsArticle: true, Title: "T"}); it.Published.Day() != 2 {
		t.Errorf("lastmod fallback: %+v", it)
	}
	if it = pageItem(entry, articlePage{Title: "Blog"}); it.Title != "" {
		t.Errorf("a section page must not become news: %+v", it)
	}
}

func TestPageWithoutArticleTag(t *testing.T) {
	text := strings.Repeat("Обычное предложение текста новости. ", 10)
	page := parsePage(strings.NewReader(`<html><head><meta property="og:title" content="Заголовок"></head><body>
<div class="sidebar"><p>Другая новость</p><p>Ещё новость</p></div>
<div class="content"><p>Заголовок</p><p>kaktus.media</p><p>Фото автора</p><p>Facebook</p><p>Все самое интересное в Telegram</p><img src="https://x.kg/pic.jpg"><p>` + text + `</p><p>` + text + `</p></div></body></html>`))
	if page.Image != "https://x.kg/pic.jpg" {
		t.Errorf("image: %q", page.Image)
	}
	body := page.body()
	if body == "" || strings.Contains(body, "Другая") || strings.Contains(body, "Заголовок") || strings.Contains(body, "kaktus.media") || strings.Contains(body, "Фото") || strings.Contains(body, "Facebook") || strings.Contains(body, "Telegram") {
		t.Errorf("body: %q", body)
	}
}

func TestVideoEnclosureIsNotAnImage(t *testing.T) {
	items, err := parseFeed(strings.NewReader(`<rss><channel><item><title>T</title><link>https://x.kg/a</link>
<enclosure url="https://x.kg/a.mp4" type="video/mp4"/></item></channel></rss>`))
	if err != nil {
		t.Fatal(err)
	}
	if items[0].Image != "" {
		t.Errorf("image: %q", items[0].Image)
	}
}

func TestFeedQuery(t *testing.T) {
	cases := []struct {
		query         string
		limit, offset int
		order         string
	}{
		{"", 12, 0, "created_at DESC, id DESC"},
		{"limit=5&offset=10&sort=old", 5, 10, "created_at ASC, id ASC"},
		{"limit=9999", 50, 0, "created_at DESC, id DESC"},
		{"limit=-1&offset=-1", 12, 0, "created_at DESC, id DESC"},
		{"limit=x&offset=y&sort=id;DROP TABLE news", 12, 0, "created_at DESC, id DESC"},
	}
	for _, c := range cases {
		q, _ := url.ParseQuery(c.query)
		limit, offset, order := feedQuery(q)
		if limit != c.limit || offset != c.offset || order != c.order {
			t.Errorf("%q: got %d %d %q", c.query, limit, offset, order)
		}
	}
}
