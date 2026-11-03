import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type News } from '../api'
import { useLang } from '../i18n'
import { useFetch } from '../useFetch'
import NewsCard from './NewsCard'

const ALL = ''
const PAGE_SIZE = 12
type Sort = 'new' | 'old'

/** Pages through /news/feed; changing the filter or the language starts over. */
function useNewsFeed(category: string, sort: Sort) {
  const { lang } = useLang()
  const [items, setItems] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const offset = useRef(0)
  // Answers to a request made under an earlier filter are dropped.
  const generation = useRef(0)

  const load = useCallback(() => {
    const current = generation.current
    setLoading(true)
    setError(null)
    api<News[]>(`/news/feed?limit=${PAGE_SIZE}&offset=${offset.current}&sort=${sort}&category=${encodeURIComponent(category)}`)
      .then((page) => {
        if (current !== generation.current) return
        offset.current += page.length
        // News published meanwhile shifts the offsets, so an item can arrive twice.
        setItems((prev) => {
          const seen = new Set(prev.map((n) => n.id))
          return [...prev, ...page.filter((n) => !seen.has(n.id))]
        })
        setDone(page.length < PAGE_SIZE)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (current !== generation.current) return
        setError(e.message)
        setLoading(false)
      })
  }, [category, sort, lang])

  useEffect(() => {
    generation.current += 1
    offset.current = 0
    setItems([])
    setDone(false)
    load()
  }, [load])

  return { items, loading, done, error, load }
}

export default function NewsFeedPage() {
  const { t, category } = useLang()
  const [cat, setCat] = useState(ALL)
  const [sort, setSort] = useState<Sort>('new')
  const { items, loading, done, error, load } = useNewsFeed(cat, sort)
  // The capped list has every rubric in it: each channel's newest items and all of the site's own.
  const list = useFetch<News[]>('/news')
  const cats = [...new Set((list.data ?? []).map((n) => n.category).filter(Boolean))]
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || loading || done || error) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) load()
    }, { rootMargin: '600px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, done, error, load])

  return (
    <section id="news" className="section">
      <div className="section-head">
        <div>
          <h1>{t('home.news')}</h1>
          <p className="lede">{t('news.lede')}</p>
        </div>
        <div className="seg" role="group" aria-label={t('home.sort')}>
          {(['new', 'old'] as const).map((s) => (
            <button key={s} type="button" className={sort === s ? 'active' : ''} aria-pressed={sort === s} onClick={() => setSort(s)}>
              {t(s === 'new' ? 'home.sortNew' : 'home.sortOld')}
            </button>
          ))}
        </div>
      </div>
      {cats.length > 0 && (
        <div className="seg" role="group" aria-label={t('home.rubrics')}>
          {[ALL, ...cats].map((c) => (
            <button key={c} type="button" className={cat === c ? 'active' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === ALL ? t('home.all') : category(c)}
            </button>
          ))}
        </div>
      )}
      <div className="grid">
        {items.map((n) => <NewsCard key={n.id} n={n} />)}
      </div>
      {!loading && !error && items.length === 0 && <div className="empty flat">{t('home.feedEmpty')}</div>}
      <div ref={sentinel} className="feed-status" aria-live="polite">
        {loading && <span className="muted">{t('common.loading')}</span>}
        {error && (
          <>
            <span className="error">{error}</span>
            <button type="button" className="btn secondary small" onClick={load}>{t('home.feedRetry')}</button>
          </>
        )}
        {done && items.length > 0 && <span className="muted">{t('home.feedEnd')}</span>}
      </div>
    </section>
  )
}
