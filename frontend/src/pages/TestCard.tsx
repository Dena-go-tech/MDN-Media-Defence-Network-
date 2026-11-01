import { Link } from 'react-router-dom'
import type { TestSummary } from '../api'
import { Arrow } from '../ui'

// Roughly 50 seconds per question.
const minutes = (n: number) => Math.max(1, Math.round((n * 50) / 60))

export default function TestCard({ t }: { t: TestSummary }) {
  return (
    <div className="test-card">
      {t.level && <span className="pill">{t.level}</span>}
      <h3>{t.title}</h3>
      {t.description && <p>{t.description}</p>}
      <span className="test-meta">{t.question_count} вопросов · около {minutes(t.question_count)} мин</span>
      <Link to={`/tests/${t.id}`} className="btn block">Начать<Arrow /></Link>
    </div>
  )
}
