import { Link, Navigate } from 'react-router-dom'
import { formatDate, type Result } from '../api'
import { useAuth } from '../auth'
import { useFetch } from '../useFetch'

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const results = useFetch<Result[]>(user ? '/me/results' : null)

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

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

      <h2>Мои результаты</h2>
      {results.data?.length === 0 && (
        <div className="empty">
          Вы ещё не проходили тесты. <Link to="/tests" className="link">Перейти к тестам</Link>
        </div>
      )}
      {!!results.data?.length && (
        <table className="table">
          <thead>
            <tr><th>Тест</th><th>Результат</th><th>Дата</th></tr>
          </thead>
          <tbody>
            {results.data.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/tests/${r.test_id}`}>{r.test_title}</Link></td>
                <td>{r.score} / {r.total} ({r.total ? Math.round((r.score / r.total) * 100) : 0}%)</td>
                <td>{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
