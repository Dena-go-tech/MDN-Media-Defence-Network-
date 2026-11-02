import { Link } from 'react-router-dom'
import { formatTime, pct, type AnswerDetail, type ResultDetail } from '../api'
import { useLang } from '../i18n'

const LETTERS = 'АБВГДЕЖЗИК'

function Answer({ q, index }: { q: AnswerDetail; index: number }) {
  const { t } = useLang()
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
            <span><small>{t('summary.answer')}</small>{q.chosen >= 0 ? q.options[q.chosen] : t('summary.noAnswer')}</span>
          </div>
        )}
        <div className="option correct">
          <span className="letter">{LETTERS[q.correct]}</span>
          <span><small>{wrong ? t('summary.correct') : t('summary.isCorrect')}</small>{q.options[q.correct]}</span>
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
  const { t } = useLang()

  return (
    <div className="result-summary">
      <div className="result-card">
        <span className="pill pink">{r.test_title}</span>
        <h1>{t('common.score', { s: r.score, t: r.total })} ({p}%)</h1>
        <p>
          {studentLink ? <Link to={studentLink} className="on-dark-link">{r.user_name}</Link> : r.user_name}
          {' · '}{formatTime(r.created_at)}
        </p>
        <div className="summary-chips">
          <span className="pill">{t('summary.right', { n: r.score })}</span>
          <span className="pill warn">{t('summary.wrongCount', { n: r.total - r.score })}</span>
        </div>
      </div>

      {r.details.length === 0 ? (
        <div className="empty">{t('summary.noDetails')}</div>
      ) : (
        <>
          <section className="panel">
            <h2>{wrong.length ? t('summary.wrong', { n: wrong.length }) : t('summary.noWrong')}</h2>
            {wrong.length === 0 && <p className="muted">{t('summary.allRight')}</p>}
            <div className="answers">
              {wrong.map(({ q, i }) => <Answer key={i} q={q} index={i} />)}
            </div>
          </section>
          {right.length > 0 && (
            <details className="panel">
              <summary><h2>{t('summary.rightList', { n: right.length })}</h2></summary>
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
