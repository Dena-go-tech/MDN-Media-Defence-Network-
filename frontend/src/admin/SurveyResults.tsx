import { Link, useParams } from 'react-router-dom'
import { api, formatTime, type SurveyStats } from '../api'
import { useFetch } from '../useFetch'

/** Percent with one decimal, written the Russian way: 68,2 (whole numbers stay whole). */
const share = (n: number, of: number) => (of ? Math.round((n * 1000) / of) / 10 : 0)
const fmtPct = (v: number) => `${String(v).replace('.', ',')}%`

/** /admin/surveys/:id — how many respondents chose each option. */
export default function SurveyResults() {
  const { id } = useParams()
  const { data, error, loading, reload } = useFetch<SurveyStats>(`/admin/tests/${id}/survey`)
  if (loading && !data) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Не найдено'}</p>

  const clear = async () => {
    if (!confirm(`Удалить все ответы на опрос «${data.title}» (${data.responses})? Это нельзя отменить.`)) return
    await api(`/admin/tests/${id}/survey`, { method: 'DELETE' })
    reload()
  }

  return (
    <>
      <Link to="/admin/tests" className="btn secondary small self-start">← Тесты и опросы</Link>
      <div className="page-head">
        <div>
          <span className="pill pink">Опрос</span>
          <h1>{data.title}</h1>
          {data.title_ky && <p className="lede" lang="ky">{data.title_ky}</p>}
        </div>
        <div className="row wrap">
          <Link to={`/tests/${data.id}`} className="btn secondary">Открыть на сайте</Link>
          {data.responses > 0 && <button className="link-btn danger" onClick={clear}>Очистить ответы</button>}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Ответов всего</span><strong>{data.responses}</strong></div>
        <div className="stat"><span>Из Google Формы</span><strong>{data.by_source.import}</strong></div>
        <div className="stat"><span>С сайта</span><strong>{data.by_source.site}</strong></div>
        <div className="stat"><span>Последний с сайта</span><strong className="stat-small">{data.last_at ? formatTime(data.last_at) : '—'}</strong></div>
      </div>
      {data.by_source.import > 0 && (
        <p className="muted small">
          Ответы из Google Формы загружены по итогам опроса (n = {data.by_source.import}); в импорте есть только вопросы, вынесенные в презентацию,
          у остальных вопросов в этой части выборки нет данных. Проценты считаются от ответивших на вопрос.
        </p>
      )}

      {data.responses === 0 ? (
        <div className="empty">Ответов пока нет. Опрос открыт по ссылке <Link to={`/tests/${data.id}`} className="link">/tests/{data.id}</Link> и в разделе «Тесты».</div>
      ) : (
        <div className="survey-results">
          {data.questions.map((q, qi) => {
            const top = Math.max(...q.counts)
            return (
              <section key={qi} className="panel">
                <div className="q-head">
                  <h2><span className="num">{qi + 1}</span>{q.text}</h2>
                </div>
                {q.text_ky && <p className="muted" lang="ky">{q.text_ky}</p>}
                <p className="muted small">
                  {q.answered === 0 ? 'Нет данных: на этот вопрос пока никто не ответил' : `Ответили ${q.answered} из ${data.responses}`}
                  {q.multiple && ' · можно было выбрать несколько, поэтому сумма больше 100%'}
                  {q.optional && ' · необязательный вопрос'}
                </p>
                <div className="bars">
                  {q.options.map((o, oi) => (
                    <div key={oi} className={`bar${q.counts[oi] === top && top > 0 ? ' lead' : ''}`}>
                      <div className="bar-label">
                        <span>{o}</span>
                        <span className="nowrap">{q.counts[oi]} · {fmtPct(share(q.counts[oi], q.answered))}</span>
                      </div>
                      <div className="bar-track"><span style={{ width: `${share(q.counts[oi], q.answered)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
