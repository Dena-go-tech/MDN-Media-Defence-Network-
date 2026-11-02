import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryColor, formatDate, formatShortDate, readMinutes, type News, type Script, type TestSummary } from '../api'
import { useLang, type TKey } from '../i18n'
import { useFetch } from '../useFetch'
import { Arrow, ICONS, Icon } from '../ui'
import TestCard, { SurveyBanner } from './TestCard'

const QUICK_QUESTIONS: TKey[] = ['home.q1', 'home.q2', 'home.q3']

const VERDICT_LABELS: Record<string, { key: TKey; className: string }> = {
  verified: { key: 'verdict.verified', className: 'verdict ok' },
  fake: { key: 'verdict.fake', className: 'verdict bad' },
  doubt: { key: 'verdict.doubt', className: 'verdict warn' },
  warning: { key: 'verdict.warning', className: 'verdict warn' },
}

const ALL = ''

function NewsCard({ n }: { n: News }) {
  const { t, category } = useLang()
  return (
    <Link to={`/news/${n.id}`} className="card">
      <div className="card-media">{n.image_url && <img src={n.image_url} alt="" />}</div>
      <div className="card-body">
        {n.category && <span className="pill tag" style={{ background: categoryColor(n.category) }}>{category(n.category)}</span>}
        <h3>{n.title}</h3>
        <div className="card-meta">
          <span>{formatShortDate(n.created_at)} · {readMinutes(n.body)} {t('common.min')}</span>
          {n.summary && <span className="pill">{t('common.summary')}</span>}
        </div>
      </div>
    </Link>
  )
}

export default function NewsPage() {
  const { t, category } = useLang()
  const news = useFetch<News[]>('/news')
  const tests = useFetch<TestSummary[]>('/tests')
  const scripts = useFetch<Script[]>('/assistant/scripts')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(ALL)

  const ask = (q: string) => navigate(`/assistant?q=${encodeURIComponent(q)}`)
  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) ask(query.trim())
  }

  const list = news.data ?? []
  const featured = list.find((n) => n.featured) ?? list[0]
  const rest = list.filter((n) => n !== featured)
  const cats = [...new Set(rest.map((n) => n.category).filter(Boolean))]
  const shown = cat === ALL ? rest : rest.filter((n) => n.category === cat)
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
        <Link to={`/news/${featured.id}`} className="feature">
          <div className="feature-media">{featured.image_url && <img src={featured.image_url} alt="" />}</div>
          <div className="feature-body">
            <span className="pill pink">{featured.featured ? t('home.featured') : t('home.fresh')}</span>
            <h2>{featured.title}</h2>
            {featured.summary && <p>{featured.summary}</p>}
            <div className="feature-meta">
              <span>{formatDate(featured.created_at)} · {readMinutes(featured.body)} {t('common.minRead')}</span>
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
            {cats.length > 0 && (
              <div className="seg" role="group" aria-label={t('home.rubrics')}>
                {[ALL, ...cats].map((c) => (
                  <button key={c} type="button" className={cat === c ? 'active' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
                    {c === ALL ? t('home.all') : category(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid">
            {shown.map((n) => <NewsCard key={n.id} n={n} />)}
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
