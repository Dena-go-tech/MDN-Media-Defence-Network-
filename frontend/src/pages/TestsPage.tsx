import type { TestSummary } from '../api'
import { useFetch } from '../useFetch'
import TestCard from './TestCard'

export default function TestsPage() {
  const { data, error, loading } = useFetch<TestSummary[]>('/tests')

  if (loading) return <p className="muted">Загрузка…</p>
  if (error) return <p className="error">{error}</p>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Тесты и самопроверка</h1>
          <p className="lede">Проверьте свои знания в области медиаправа, медиаграмотности и цифровой безопасности. Результаты сохраняются в профиле.</p>
        </div>
      </div>
      {data?.length === 0 && <div className="empty">Тестов пока нет.</div>}
      <div className="test-grid">
        {data?.map((t) => <TestCard key={t.id} t={t} />)}
      </div>
    </>
  )
}
