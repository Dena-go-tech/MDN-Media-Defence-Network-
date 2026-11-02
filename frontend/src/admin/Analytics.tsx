import { Link } from 'react-router-dom'
import { formatTime, pct, type Stats, type TestSummary } from '../api'
import { useFetch } from '../useFetch'

export default function Analytics() {
  const { data, error, loading } = useFetch<Stats>('/admin/stats')
  const tests = useFetch<TestSummary[]>('/admin/tests')
  const surveys = (tests.data ?? []).filter((t) => t.kind === 'survey')

  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Нет данных'}</p>

  const attempted = data.tests.filter((t) => t.attempts > 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Результаты тестов</h1>
          <p className="lede">Каждое завершение теста на портале попадает сюда. Откройте результат, чтобы увидеть, в каких вопросах ошиблись.</p>
        </div>
        <div className="row wrap">
          <Link to="/admin/students" className="btn secondary">Студенты</Link>
          <Link to="/admin/tests" className="btn">Управление тестами</Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Пройдено тестов</span><strong>{data.attempts}</strong></div>
        <div className="stat"><span>Средний балл</span><strong>{data.avg_pct}%</strong></div>
        <div className="stat"><span>Участников</span><strong>{data.users}</strong></div>
        <div className="stat"><span>Опубликовано тестов</span><strong>{data.published_tests}</strong></div>
      </div>

      <div className="split">
        <section className="panel">
          <h2>Где чаще всего ошибаются</h2>
          {attempted.length === 0 && <p className="muted">Пока никто не проходил тесты.</p>}
          <div className="bars">
            {attempted.map((t) => (
              <div key={t.id} className="bar">
                <div className="bar-label"><span>{t.title}</span><span className="muted">{100 - t.avg_pct}% ошибок</span></div>
                <div className="bar-track"><span style={{ width: `${100 - t.avg_pct}%` }} /></div>
              </div>
            ))}
          </div>
          {attempted.length > 0 && <p className="muted small">Доля неверных ответов по каждому тесту.</p>}
        </section>

        <section className="panel wide">
          <h2>Последние результаты</h2>
          {data.recent.length === 0 ? (
            <p className="muted">Результатов пока нет.</p>
          ) : (
            <div className="table-wrap">
              <table className="table clickable">
                <thead>
                  <tr><th>Время</th><th>Участник</th><th>Тест</th><th>Результат</th><th></th></tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="muted nowrap">{formatTime(r.created_at)}</td>
                      <td><Link to={`/admin/students/${r.user_id}`} className="row-link">{r.user_name}</Link></td>
                      <td><Link to={`/admin/results/${r.id}`} className="row-link"><strong>{r.test_title}</strong></Link></td>
                      <td>
                        <span className={`pill ${pct(r.score, r.total) >= 67 ? '' : 'warn'}`}>
                          {r.score} из {r.total}
                        </span>
                      </td>
                      <td><Link to={`/admin/results/${r.id}`} className="link nowrap">Разбор →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {surveys.length > 0 && (
        <section className="panel">
          <h2>Опросы</h2>
          <div className="table-wrap">
            <table className="table clickable">
              <thead><tr><th>Опрос</th><th>Ответов</th><th>Статус</th><th></th></tr></thead>
              <tbody>
                {surveys.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/admin/surveys/${s.id}`} className="row-link"><strong>{s.title}</strong></Link></td>
                    <td>{s.responses}</td>
                    <td><span className={`pill${s.published ? '' : ' pink'}`}>{s.published ? 'Опубликован' : 'Черновик'}</span></td>
                    <td><Link to={`/admin/surveys/${s.id}`} className="link nowrap">Ответы →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Самые трудные вопросы</h2>
        {data.hard_questions.length === 0 ? (
          <p className="muted">Появится, когда студенты начнут ошибаться в тестах.</p>
        ) : (
          <div className="bars">
            {data.hard_questions.map((h, i) => (
              <div key={i} className="bar">
                <div className="bar-label">
                  <span>{h.question} <span className="muted small">· {h.test_title}</span></span>
                  <span className="muted nowrap">{h.wrong} из {h.answers} ({h.wrong_pct}%)</span>
                </div>
                <div className="bar-track"><span style={{ width: `${h.wrong_pct}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        <p className="muted small">Доля неверных ответов на каждый вопрос по всем попыткам.</p>
      </section>
    </>
  )
}
