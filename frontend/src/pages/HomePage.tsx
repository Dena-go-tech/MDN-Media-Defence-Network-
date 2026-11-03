import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDate, readMinutes, type News, type Script, type TestSummary } from '../api'
import { useLang, type TKey } from '../i18n'
import { useFetch } from '../useFetch'
import { Arrow, ICONS, Icon } from '../ui'
import NewsCard from './NewsCard'
import TestCard, { SurveyBanner } from './TestCard'

const QUICK_QUESTIONS: TKey[] = ['home.q1', 'home.q2', 'home.q3']

const VERDICT_LABELS: Record<string, { key: TKey; className: string }> = {
  verified: { key: 'verdict.verified', className: 'verdict ok' },
  fake: { key: 'verdict.fake', className: 'verdict bad' },
  doubt: { key: 'verdict.doubt', className: 'verdict warn' },
  warning: { key: 'verdict.warning', className: 'verdict warn' },
}

// Stories on the home page, the big card included; the rest of the news is at /news.
const HOME_NEWS = 10

export default function HomePage() {
  const { t } = useLang()
  const news = useFetch<News[]>('/news')
  const latest = useFetch<News[]>(`/news/feed?limit=${HOME_NEWS}`)
  const tests = useFetch<TestSummary[]>('/tests')
  const scripts = useFetch<Script[]>('/assistant/scripts')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const ask = (q: string) => navigate(`/assistant?q=${encodeURIComponent(q)}`)
  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) ask(query.trim())
  }

  const list = news.data ?? []
  // The big card belongs to the editors: an imported item takes it only when nothing else exists.
  const featured = list.find((n) => n.featured) ?? list.find((n) => !n.source_url) ?? list[0]
  const rest = (latest.data ?? []).filter((n) => n.id !== featured?.id).slice(0, HOME_NEWS - 1)
  const example = scripts.data?.[0]
  const quizzes = (tests.data ?? []).filter((x) => x.kind !== 'survey')
  const survey = (tests.data ?? []).find((x) => x.kind === 'survey')

  return (
    <>
      <section className="intro">
        <span className="pill dot">{t('home.kicker')}</span>
        <h1>{t('home.title1')} <em>{t('home.title2')}</em></h1>
        <p>{t('home.lede')}</p>
        <form className="searchbar" onSubmit={onSearch} role="search">
          <Icon d={ICONS.search} size={22} />
          <input
            aria-label={t('home.searchLabel')}
            placeholder={t('home.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn dark" type="submit">{t('common.ask')}</button>
        </form>
        <div className="chips">
          {QUICK_QUESTIONS.map((k) => <button key={k} type="button" className="chip" onClick={() => ask(t(k))}>{t(k)}</button>)}
        </div>
      </section>

      {news.loading && <p className="muted">{t('common.loading')}</p>}
      {news.error && <p className="error">{news.error}</p>}

      {featured ? (
        <Link to={`/news/${featured.id}`} className={`feature${featured.image_url ? '' : ' no-media'}`}>
          {featured.image_url && <div className="feature-media"><img src={featured.image_url} alt="" referrerPolicy="no-referrer" /></div>}
          <div className="feature-body">
            <span className="pill pink">{featured.featured ? t('home.featured') : t('home.fresh')}</span>
            <h2>{featured.title}</h2>
            {featured.summary && <p>{featured.summary}</p>}
            <div className="feature-meta">
              <span>{formatDate(featured.created_at)} · {featured.source_name || `${readMinutes(featured.body)} ${t('common.minRead')}`}</span>
              <span className="btn light">{t('home.read')}<Arrow /></span>
            </div>
          </div>
        </Link>
      ) : (
        !news.loading && <div className="empty">{t('home.empty')}</div>
      )}

      {survey && <SurveyBanner s={survey} />}

      {rest.length > 0 && (
        <section id="news" className="section">
          <div className="section-head">
            <h2>{t('home.news')}</h2>
            <Link to="/news" className="btn secondary">{t('home.allNews')}<Arrow /></Link>
          </div>
          <div className="grid">
            {rest.map((n) => <NewsCard key={n.id} n={n} />)}
          </div>
        </section>
      )}

      {quizzes.length > 0 && (
        <section id="tests" className="dark-block">
          <div className="dark-block-head">
            <div>
              <h2>{t('home.testsTitle')}</h2>
              <p>{t('home.testsLede')}</p>
            </div>
            <ol className="steps">
              <li><span>1</span>{t('home.step1')}</li>
              <li><span>2</span>{t('home.step2')}</li>
              <li><span>3</span>{t('home.step3')}</li>
            </ol>
          </div>
          <div className="test-grid">
            {quizzes.slice(0, 3).map((x) => <TestCard key={x.id} t={x} />)}
          </div>
          {quizzes.length > 3 && <Link to="/tests" className="btn light more">{t('home.allTests')}<Arrow /></Link>}
        </section>
      )}

      <section className="promo">
        <div className="promo-text">
          <span className="pill pink">{t('home.promoTag')}</span>
          <h2>{t('home.promoTitle')}</h2>
          <p>{t('home.promoText')}</p>
          <Link to="/assistant" className="btn dark">{t('home.promoOpen')}<Arrow /></Link>
        </div>
        <div className="chat-preview">
          {example && (
            <>
              <div className="bubble user">{example.question}</div>
              <div className="bubble assistant">
                <p>{example.answer.split('\n')[0]}</p>
                {VERDICT_LABELS[example.verdict] && (
                  <span className={VERDICT_LABELS[example.verdict].className}>{t(VERDICT_LABELS[example.verdict].key)}</span>
                )}
              </div>
            </>
          )}
          <form className="mini-input" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get('q'); if (v) ask(String(v)) }}>
            <input name="q" aria-label={t('home.promoInputLabel')} placeholder={t('home.promoInput')} />
            <button className="icon-btn" type="submit" aria-label={t('home.send')}><Arrow /></button>
          </form>
          <span className="muted small">{t('home.aiWarn')}</span>
        </div>
      </section>
    </>
  )
}
