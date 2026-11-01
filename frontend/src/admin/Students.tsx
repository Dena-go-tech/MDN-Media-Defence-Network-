import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDate, formatTime, pct, type ResultDetail, type Student } from '../api'
import ResultSummary from '../pages/ResultSummary'
import { useFetch } from '../useFetch'

interface StudentResult {
  id: number
  test_id: number
  test_title: string
  score: number
  total: number
  created_at: string
}

const scoreClass = (p: number) => `pill${p >= 67 ? '' : ' warn'}`

/** /admin/results/:id — one attempt with the questions the student got wrong. */
export function AdminResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useFetch<ResultDetail>(`/admin/results/${id}`)
  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Не найдено'}</p>
  return (
    <>
      <button className="btn secondary small self-start" onClick={() => navigate(-1)}>← Назад</button>
      <ResultSummary r={data} studentLink={`/admin/students/${data.user_id}`} />
    </>
  )
}

/** /admin/students — everyone registered, with their activity. */
export function StudentsAdmin() {
  const { data, error, loading } = useFetch<Student[]>('/admin/students')
  const [q, setQ] = useState('')
  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Нет данных'}</p>

  const needle = q.trim().toLowerCase()
  const list = data.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Студенты</h1>
          <p className="lede">Все зарегистрированные участники и их результаты. Откройте студента, чтобы увидеть каждую попытку и ошибки в ней.</p>
        </div>
        <span className="pill">{data.length} чел.</span>
      </div>
      <input className="search-input" type="search" placeholder="Поиск по имени или почте" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск студента" />
      <section className="panel">
        {list.length === 0 ? <p className="muted">Никого не нашли.</p> : (
          <div className="table-wrap">
            <table className="table clickable">
              <thead>
                <tr><th>Студент</th><th>Попыток</th><th>Средний балл</th><th>Последняя попытка</th></tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/admin/students/${s.id}`} className="row-link"><strong>{s.name}</strong></Link>
                      <div className="muted small">{s.email}{s.role === 'admin' ? ' · админ' : ''}</div>
                    </td>
                    <td>{s.attempts}</td>
                    <td>{s.attempts ? <span className={scoreClass(s.avg_pct)}>{s.avg_pct}%</span> : <span className="muted">—</span>}</td>
                    <td className="nowrap">{s.last_at ? formatTime(s.last_at) : <span className="muted">не проходил</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

/** /admin/students/:id — one student's attempts; each opens the error breakdown. */
export function StudentDetail() {
  const { id } = useParams()
  const { data, error, loading } = useFetch<{ student: Student; results: StudentResult[] }>(`/admin/students/${id}`)
  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Не найдено'}</p>
  const { student: s, results } = data

  return (
    <>
      <Link to="/admin/students" className="btn secondary small self-start">← Все студенты</Link>
      <div className="profile-head">
        <div className="avatar">{s.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{s.name}</h1>
          <p className="muted">{s.email} · с {formatDate(s.created_at)}</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>Попыток</span><strong>{s.attempts}</strong></div>
        <div className="stat"><span>Средний балл</span><strong>{s.avg_pct}%</strong></div>
        <div className="stat"><span>Разных тестов</span><strong>{new Set(results.map((r) => r.test_id)).size}</strong></div>
      </div>
      <section className="panel">
        <h2>Попытки</h2>
        {results.length === 0 ? <p className="muted">Студент ещё не проходил тесты.</p> : (
          <div className="table-wrap">
            <table className="table clickable">
              <thead><tr><th>Тест</th><th>Результат</th><th>Ошибок</th><th>Дата</th><th></th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/admin/results/${r.id}`} className="row-link"><strong>{r.test_title}</strong></Link></td>
                    <td><span className={scoreClass(pct(r.score, r.total))}>{r.score} из {r.total}</span></td>
                    <td>{r.total - r.score}</td>
                    <td className="nowrap">{formatTime(r.created_at)}</td>
                    <td><Link to={`/admin/results/${r.id}`} className="link nowrap">Разбор →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
