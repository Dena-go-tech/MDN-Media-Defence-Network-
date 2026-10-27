import { Link } from 'react-router-dom'
import { formatDate, type News, type TestSummary } from '../api'
import { useFetch } from '../useFetch'

export default function NewsPage() {
  const news = useFetch<News[]>('/news')
  const tests = useFetch<TestSummary[]>('/tests')

  if (news.loading) return <p className="muted">Загрузка…</p>
  if (news.error) return <p className="error">{news.error}</p>

  const list = news.data ?? []
  const featured = list.find((n) => n.featured) ?? list[0]
  const rest = list.filter((n) => n !== featured)

  return (
    <>
      {featured ? (
        <Link to={`/news/${featured.id}`} className="hero">
          {featured.image_url && <img src={featured.image_url} alt="" />}
          <div className="hero-body">
            {featured.featured && <span className="badge">Главное</span>}
            <h1>{featured.title}</h1>
            <p>{featured.summary}</p>
            <span className="muted">{formatDate(featured.created_at)}</span>
          </div>
        </Link>
      ) : (
        <div className="empty">Новостей пока нет. Добавьте первую через админку.</div>
      )}

      <div className="layout">
        <section>
          {rest.length > 0 && <h2>Последние новости</h2>}
          <div className="grid">
            {rest.map((n) => (
              <Link key={n.id} to={`/news/${n.id}`} className="card">
                {n.image_url && <img src={n.image_url} alt="" />}
                <div className="card-body">
                  <h3>{n.title}</h3>
                  <p>{n.summary}</p>
                  <span className="muted">{formatDate(n.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <aside className="sidebar">
          <h2>Проверьте себя</h2>
          {(tests.data ?? []).slice(0, 4).map((t) => (
            <Link key={t.id} to={`/tests/${t.id}`} className="side-item">
              <strong>{t.title}</strong>
              <span className="muted">{t.question_count} вопросов</span>
            </Link>
          ))}
          {tests.data?.length === 0 && <p className="muted">Тестов пока нет.</p>}
          <Link to="/tests" className="link">Все тесты →</Link>
        </aside>
      </div>
    </>
  )
}
