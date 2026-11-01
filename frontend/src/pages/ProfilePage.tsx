import { Link, Navigate, useParams } from 'react-router-dom'
import { formatDate, type Result, type ResultDetail } from '../api'
import ResultSummary from './ResultSummary'
import { useAuth } from '../auth'
import { useFetch } from '../useFetch'

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const results = useFetch<Result[]>(user ? '/me/results' : null)

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const list = results.data ?? []
  const avg = list.length
    ? Math.round(list.reduce((s, r) => s + (r.total ? r.score / r.total : 0), 0) / list.length * 100)
    : 0

  return (
    <>
      <div className="profile-head">
        <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.email} · с {formatDate(user.created_at)}</p>
        </div>
        <button className="btn secondary" onClick={logout}>Выйти</button>
      </div>

      {list.length > 0 && (
        <div className="stats">
          <div className="stat"><span>Пройдено тестов</span><strong>{list.length}</strong></div>
          <div className="stat"><span>Средний балл</span><strong>{avg}%</strong></div>
        </div>
      )}

      <section className="panel">
        <h2>Мои результаты</h2>
        {results.data?.length === 0 && (
          <div className="empty flat">
            Вы ещё не проходили тесты. <Link to="/tests" className="link">Перейти к тестам</Link>
          </div>
        )}
        {list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Тест</th><th>Результат</th><th>Дата</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/profile/results/${r.id}`} className="row-link"><strong>{r.test_title}</strong></Link></td>
                    <td>{r.score} / {r.total} ({r.total ? Math.round((r.score / r.total) * 100) : 0}%)</td>
                    <td className="nowrap">{formatDate(r.created_at)}</td>
                    <td><Link to={`/profile/results/${r.id}`} className="link nowrap">Разбор →</Link></td>
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

/** /profile/results/:id — the student's own breakdown of one attempt. */
export function MyResult() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { data, error, loading } = useFetch<ResultDetail>(user ? `/me/results/${id}` : null)
  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Не найдено'}</p>
  return (
    <>
      <Link to="/profile" className="btn secondary small self-start">← Мои результаты</Link>
      <ResultSummary r={data} />
      <div className="row wrap">
        <Link to={`/tests/${data.test_id}`} className="btn">Пройти тест ещё раз</Link>
        <Link to={`/assistant?q=${encodeURIComponent(`Объясни мои ошибки в тесте «${data.test_title}»`)}`} className="btn secondary">Спросить BulbAI</Link>
      </div>
    </>
  )
}
