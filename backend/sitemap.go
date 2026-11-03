package main

import (
	"context"
	"errors"
	"log"
	"sort"
	"time"
)

// A sitemap is the way in for sites whose robots.txt closes the RSS feed but publishes a
// sitemap and leaves the articles open. It lists addresses only, so title, text and date
// come from each article's page, under the same robots.txt check.

const (
	// A backlog is worked off over several polls rather than hitting the site all at once.
	sitemapPagesPerPoll = 15
	// An old article edited today makes its old sitemap look fresh, so one is not enough.
	sitemapsPerPoll = 3
)

type sitemapEntry struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod"`
}

// newestEntries sorts by change date, undated entries last.
func newestEntries(entries []sitemapEntry) []sitemapEntry {
	out := append([]sitemapEntry(nil), entries...)
	sort.SliceStable(out, func(i, j int) bool {
		return parseFeedDate(out[i].LastMod).After(parseFeedDate(out[j].LastMod))
	})
	return out
}

// pageItem turns a page into an item. Other kinds of page get an empty title, which makes
// storeItems note them, so they aren't fetched again, and never publish them.
func pageItem(entry sitemapEntry, page articlePage) FeedItem {
	if !page.IsArticle {
		return FeedItem{GUID: entry.Loc, Link: safeURL(entry.Loc)}
	}
	it := FeedItem{GUID: entry.Loc, Link: safeURL(entry.Loc), Title: page.Title, Summary: page.Summary, Body: page.body(), Image: page.Image}
	it.Published = parseFeedDate(firstNonEmpty(page.Published, entry.LastMod))
	if now := time.Now(); it.Published.After(now) {
		it.Published = now
	}
	return it
}

// readSitemapPages fetches the newest pages not seen yet.
func (a *App) readSitemapPages(ctx context.Context, s Source, entries []sitemapEntry) ([]FeedItem, error) {
	locs := make([]string, len(entries))
	for i, e := range entries {
		locs[i] = e.Loc
	}
	rows, err := a.db.Query(ctx, `SELECT guid FROM source_items WHERE source_id = $1 AND guid = ANY($2)`, s.ID, locs)
	if err != nil {
		return nil, err
	}
	known := map[string]bool{}
	for rows.Next() {
		var guid string
		if err := rows.Scan(&guid); err != nil {
			rows.Close()
			return nil, err
		}
		known[guid] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var items []FeedItem
	var failures int
	var lastErr error
	tried := 0
	for _, entry := range entries {
		if known[entry.Loc] || safeURL(entry.Loc) == "" {
			continue
		}
		if tried == sitemapPagesPerPoll {
			break
		}
		if tried > 0 {
			select {
			case <-ctx.Done():
				return items, ctx.Err()
			case <-time.After(pageFetchPause):
			}
		}
		tried++
		fetchCtx, cancel := context.WithTimeout(ctx, pageFetchTimeout)
		page, err := fetchArticlePage(fetchCtx, entry.Loc)
		cancel()
		switch {
		case errors.Is(err, errRobotsBlocked):
			// Closed pages get an empty record too, so they don't take up the next polls.
			items = append(items, FeedItem{GUID: entry.Loc, Link: entry.Loc})
		case err != nil:
			// Left unrecorded, so it is tried again on the next poll.
			log.Printf("sources: %s: %v", entry.Loc, err)
			failures++
			lastErr = err
		default:
			items = append(items, pageItem(entry, page))
		}
	}
	// Some pages may fail, but a site where none opens counts as not answering.
	if tried > 0 && failures == tried {
		return nil, lastErr
	}
	return items, nil
}
