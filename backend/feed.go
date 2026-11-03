package main

import (
	"encoding/xml"
	"errors"
	"html"
	"io"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// FeedItem is one RSS or Atom entry, cleaned up and safe to store.
type FeedItem struct {
	GUID      string
	Title     string
	Summary   string
	Body      string // excerpt of the article; empty when the feed has only a lead
	Link      string
	Image     string
	Published time.Time // zero when the feed gives no date
}

type xmlMedia struct {
	URL  string `xml:"url,attr"`
	Type string `xml:"type,attr"`
	Text string `xml:",chardata"` // Atom <content> holds the article text
}

type xmlLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
	Text string `xml:",chardata"`
}

// xmlEntry covers both RSS <item> and Atom <entry>: the field names barely overlap.
type xmlEntry struct {
	Title       string     `xml:"title"`
	Links       []xmlLink  `xml:"link"`
	Description string     `xml:"description"`
	Encoded     string     `xml:"encoded"` // content:encoded
	AtomSummary string     `xml:"summary"`
	PubDate     string     `xml:"pubDate"`
	DCDate      string     `xml:"date"`
	Published   string     `xml:"published"`
	Updated     string     `xml:"updated"`
	GUID        string     `xml:"guid"`
	ID          string     `xml:"id"`
	Enclosures  []xmlMedia `xml:"enclosure"`
	Media       []xmlMedia `xml:"content"`
	Thumbnails  []xmlMedia `xml:"thumbnail"`
}

type xmlFeed struct {
	Channel struct {
		Items []xmlEntry `xml:"item"`
	} `xml:"channel"`
	Items   []xmlEntry `xml:"item"` // RSS 1.0 keeps items at the top level
	Entries []xmlEntry `xml:"entry"`

	// A sitemap instead of a feed: an index of sitemaps, or a list of pages.
	Sitemaps []sitemapEntry `xml:"sitemap"`
	URLs     []sitemapEntry `xml:"url"`
}

const summaryMaxRunes = 400

var (
	htmlTag = regexp.MustCompile(`(?s)<[^>]*>`)
	spaces  = regexp.MustCompile(`[\s\x{00a0}]+`) // \s alone misses the non-breaking space
)

func decodeFeed(r io.Reader) (doc xmlFeed, err error) {
	dec := xml.NewDecoder(r)
	dec.Strict = false
	dec.Entity = xml.HTMLEntity
	err = dec.Decode(&doc)
	return doc, err
}

func parseFeed(r io.Reader) ([]FeedItem, error) {
	doc, err := decodeFeed(r)
	if err != nil {
		return nil, err
	}
	return doc.items()
}

func (doc xmlFeed) items() ([]FeedItem, error) {
	entries := append(append(doc.Channel.Items, doc.Items...), doc.Entries...)
	now := time.Now()
	items := make([]FeedItem, 0, len(entries))
	for _, e := range entries {
		if it, ok := e.toItem(now); ok {
			items = append(items, it)
		}
	}
	if len(items) == 0 {
		return nil, errors.New("в ленте нет записей")
	}
	return items, nil
}

func (e xmlEntry) toItem(now time.Time) (FeedItem, bool) {
	it := FeedItem{
		Title:   cleanText(e.Title),
		Summary: truncateRunes(cleanText(firstNonEmpty(e.Description, e.AtomSummary)), summaryMaxRunes),
		Link:    e.link(),
		Image:   e.image(),
	}
	var atomContent string
	for _, m := range e.Media {
		atomContent = firstNonEmpty(atomContent, m.Text)
	}
	it.Body = feedBody(firstNonEmpty(e.Encoded, atomContent, e.Description, e.AtomSummary))
	it.GUID = firstNonEmpty(strings.TrimSpace(e.GUID), strings.TrimSpace(e.ID), it.Link)
	if it.Title == "" || it.Link == "" {
		return it, false
	}
	it.Published = parseFeedDate(firstNonEmpty(e.PubDate, e.Published, e.DCDate, e.Updated))
	// A clock ahead of ours must not pin an item to the top of the news. A missing date
	// stays zero: storeItems decides what it means.
	if it.Published.After(now) {
		it.Published = now
	}
	return it, true
}

func (e xmlEntry) link() string {
	for _, l := range e.Links {
		if l.Rel == "" || l.Rel == "alternate" {
			if u := safeURL(firstNonEmpty(l.Href, l.Text)); u != "" {
				return u
			}
		}
	}
	return ""
}

func (e xmlEntry) image() string {
	for _, list := range [][]xmlMedia{e.Enclosures, e.Media, e.Thumbnails} {
		for _, m := range list {
			if m.Type == "" || strings.HasPrefix(m.Type, "image/") {
				if u := safeURL(m.URL); u != "" {
					return u
				}
			}
		}
	}
	return ""
}

func parseFeedDate(s string) time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}
	}
	if t, err := mail.ParseDate(s); err == nil {
		return t
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

// cleanText turns a feed's HTML fragment into plain text.
func cleanText(s string) string {
	// Unescaped first as well: some feeds escape their HTML twice.
	s = htmlTag.ReplaceAllString(html.UnescapeString(s), " ")
	s = html.UnescapeString(s)
	return strings.TrimSpace(spaces.ReplaceAllString(s, " "))
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return strings.TrimSpace(string(r[:n])) + "…"
}

// safeURL keeps absolute http(s) addresses only: links end up in href and src attributes.
func safeURL(s string) string {
	u, err := url.Parse(strings.TrimSpace(s))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ""
	}
	return u.String()
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// robotsAllowed applies robots.txt to a path: the group naming the bot wins over "*",
// and among matching rules the longest pattern wins, with Allow winning a tie.
func robotsAllowed(body, bot, target string) bool {
	groups := map[string][][2]string{}
	var agents []string
	inRules := false
	for _, line := range strings.Split(body, "\n") {
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		key, value = strings.ToLower(strings.TrimSpace(key)), strings.TrimSpace(value)
		switch key {
		case "user-agent":
			if inRules {
				agents, inRules = nil, false
			}
			agents = append(agents, strings.ToLower(value))
		case "allow", "disallow":
			inRules = true
			if value == "" {
				continue
			}
			for _, a := range agents {
				groups[a] = append(groups[a], [2]string{key, value})
			}
		}
	}
	rules, ok := groups[strings.ToLower(bot)]
	if !ok {
		rules = groups["*"]
	}
	allowed, best := true, -1
	for _, rule := range rules {
		if !robotsMatch(rule[1], target) {
			continue
		}
		if n := len(rule[1]); n > best || (n == best && rule[0] == "allow") {
			allowed, best = rule[0] == "allow", n
		}
	}
	return allowed
}

func robotsMatch(pattern, target string) bool {
	anchored := strings.HasSuffix(pattern, "$")
	expr := "^" + strings.ReplaceAll(regexp.QuoteMeta(strings.TrimSuffix(pattern, "$")), `\*`, ".*")
	if anchored {
		expr += "$"
	}
	re, err := regexp.Compile(expr)
	return err == nil && re.MatchString(target)
}
