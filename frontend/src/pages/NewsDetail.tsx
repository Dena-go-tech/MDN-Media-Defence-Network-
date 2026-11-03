import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { categoryColor, formatDate, readMinutes, type News, type TestSummary } from '../api'
import { useLang } from '../i18n'
import { useFetch } from '../useFetch'
import { ICONS, Icon } from '../ui'
import SourceVote from './SourceVote'

// A line holding only an image URL (uploaded or external) is shown as a picture.
const IMAGE_LINE = /^(\/uploads\/\S+|https?:\/\/\S+\.(jpe?g|png|webp|gif)(\?\S*)?)$/i

export default function NewsDetail() {
  const { id } = useParams()
  const { t, category, questions } = useLang()
  const { data, error, loading } = useFetch<News>(`/news/${id}`)
  const all = useFetch<News[]>('/news')
  const tests = useFetch<TestSummary[]>('/tests')
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')

  if (loading) return <p className="muted">{t('common.loading')}</p>
  if (error || !data) return <p className="error">{error ?? t('common.notFound')}</p>

  const related = (all.data ?? []).filter((n) => n.id !== data.id).slice(0, 3)
  const test = tests.data?.find((x) => x.kind !== 'survey')

  const ask = (e: FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    navigate(`/assistant?q=${encodeURIComponent(t('article.askSuffix', { q: question.trim(), title: data.title }))}`)
  }

  return (
    <div className="article-layout">
      <article className="article">
        <nav className="crumbs" aria-label={t('article.crumbs')}>
          <Link to="/news">{t('nav.news')}</Link><span aria-hidden="true">/</span><span>{data.category ? category(data.category) : t('article.material')}</span>
        </nav>
        <div className="article-meta">
          {data.category && <span className="pill solid" style={{ background: categoryColor(data.category) }}>{category(data.category)}</span>}
          <span>{formatDate(data.created_at)} · {data.source_name || `${readMinutes(data.body)} ${t('common.minRead')}`}</span>
        </div>
        <h1>{data.title}</h1>
        {data.image_url && <img className="article-media" src={data.image_url} alt="" referrerPolicy="no-referrer" />}

        {data.source_url && (
          <aside className="source-box">
            <p>{t('article.importNote', { source: data.source_name })}</p>
            <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="btn dark small">{t('article.readOriginal')}</a>
            {data.source_id && <SourceVote sourceId={data.source_id} name={data.source_name} />}
          </aside>
        )}


        {/* An imported summary is just the start of the text below. */}
        {data.summary && !(data.source_url && data.body) && (
          <section className="summary-box" aria-label={t('common.summary')}>
            <div className="summary-head"><span><Icon d={ICONS.spark} /></span><strong>{t('common.summary')}</strong></div>
            <p>{data.summary}</p>
          </section>
        )}

        <div className="article-body">
          {data.body.split('\n').filter((l) => l.trim()).map((line, i) =>
            IMAGE_LINE.test(line.trim())
              ? <img key={i} className="article-inline-img" src={line.trim()} alt="" loading="lazy" />
              : <p key={i}>{line}</p>,
          )}
        </div>
      </article>

      <aside className="side-stack">
        {test && (
          <div className="side-card dark">
            <span className="pill pink">{t('article.checkTag')}</span>
            <h2>{test.title}</h2>
            <p>{t('article.checkText', { q: questions(test.question_count) })}</p>
            <Link to={`/tests/${test.id}`} className="btn light block">{t('article.takeTest')}</Link>
          </div>
        )}
        <form className="side-card" onSubmit={ask}>
          <h2>{t('article.askTitle')}</h2>
          <input aria-label={t('article.askLabel')} placeholder={t('article.askPlaceholder')} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="btn block" type="submit">{t('common.ask')}</button>
        </form>
        {related.length > 0 && (
          <div className="side-card">
            <h2>{t('article.related')}</h2>
            <div className="side-links">
              {related.map((n) => <Link key={n.id} to={`/news/${n.id}`}>{n.title}</Link>)}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
