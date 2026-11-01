import { Link } from 'react-router-dom'
import { formatTime, pct, type AnswerDetail, type ResultDetail } from '../api'

const LETTERS = 'АБВГДЕЖЗИК'

function Answer({ q, index }: { q: AnswerDetail; index: number }) {
  const wrong = q.chosen !== q.correct
  return (
    <div className={`answer-card${wrong ? ' wrong' : ''}`}>
      <div className="answer-head">
        <span className="num">{index + 1}</span>
        <strong>{q.text}</strong>
      </div>
      <div className="answer-lines">
        {wrong && (
          <div className="option wrong">
            <span className="letter">{q.chosen >= 0 ? LETTERS[q.chosen] : '—'}</span>
            <span><small>Ответ</small>{q.chosen >= 0 ? q.options[q.chosen] : 'Нет ответа'}</span>
          </div>
        )}
        <div className="option correct">
          <span className="letter">{LETTERS[q.correct]}</span>
          <span><small>{wrong ? 'Верный ответ' : 'Ответ верный'}</small>{q.options[q.correct]}</span>
        </div>
      </div>
    </div>
  )
}

/** Breakdown of one attempt: which questions were answered wrong, and what the right answer was. */
export default function ResultSummary({ r, studentLink }: { r: ResultDetail; studentLink?: string }) {
  const wrong = r.details.map((q, i) => ({ q, i })).filter(({ q }) => q.chosen !== q.correct)
  const right = r.details.map((q, i) => ({ q, i })).filter(({ q }) => q.chosen === q.correct)
  const p = pct(r.score, r.total)

  return (
    <div className="result-summary">
      <div className="result-card">
        <span className="pill pink">{r.test_title}</span>
        <h1>{r.score} из {r.total} ({p}%)</h1>
        <p>
          {studentLink ? <Link to={studentLink} className="on-dark-link">{r.user_name}</Link> : r.user_name}
          {' · '}{formatTime(r.created_at)}
        </p>
        <div className="summary-chips">
          <span className="pill">Верно: {r.score}</span>
          <span className="pill warn">Ошибок: {r.total - r.score}</span>
        </div>
      </div>

      {r.details.length === 0 ? (
        <div className="empty">Подробностей по этой попытке нет: она сохранена до того, как начали записываться ответы.</div>
      ) : (
        <>
          <section className="panel">
            <h2>{wrong.length ? `Ошибки (${wrong.length})` : 'Ошибок нет'}</h2>
            {wrong.length === 0 && <p className="muted">Все ответы верные.</p>}
            <div className="answers">
              {wrong.map(({ q, i }) => <Answer key={i} q={q} index={i} />)}
            </div>
          </section>
          {right.length > 0 && (
            <details className="panel">
              <summary><h2>Верные ответы ({right.length})</h2></summary>
              <div className="answers">
                {right.map(({ q, i }) => <Answer key={i} q={q} index={i} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
