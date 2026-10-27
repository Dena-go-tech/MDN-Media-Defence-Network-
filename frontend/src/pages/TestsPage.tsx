import { Link } from 'react-router-dom'
import type { TestSummary } from '../api'
import { useFetch } from '../useFetch'

export default function TestsPage() {
  const { data, error, loading } = useFetch<TestSummary[]>('/tests')

  if (loading) return <p className="muted">Загрузка…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <h1>Тесты</h1>
      <p className="muted">Проверьте свои знания в области медиаграмотности и цифровой безопасности.</p>
      {data?.length === 0 && <div className="empty">Тестов пока нет.</div>}
      <div className="grid">
        {data?.map((t) => (
          <Link key={t.id} to={`/tests/${t.id}`} className="card">
            <div className="card-body">
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              <span className="muted">{t.question_count} вопросов</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
