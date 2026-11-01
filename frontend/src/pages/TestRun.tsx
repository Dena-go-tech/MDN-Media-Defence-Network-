import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type PublicTest, type SubmitResult } from '../api'
import { useAuth } from '../auth'
import { useFetch } from '../useFetch'
import { Arrow } from '../ui'

const LETTERS = 'АБВГДЕЖЗИК'

export default function TestRun() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: test, error, loading } = useFetch<PublicTest>(`/tests/${id}`)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !test) return <p className="error">{error ?? 'Не найдено'}</p>

  if (!user) {
    return (
      <div className="quiz">
        <span className="pill">{test.title}</span>
        <h1>Войдите, чтобы пройти тест</h1>
        <p className="muted">Результат сохранится в профиле и попадёт в аналитику сети.</p>
        <Link to="/login" className="btn">Войти</Link>
      </div>
    )
  }

  const total = test.questions.length
  const restart = () => {
    setStep(0)
    setAnswers([])
    setResult(null)
  }

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0
    return (
      <div className="quiz-wrap">
        <div className="result-card">
          <span className="pill pink">Результат</span>
          <h1>{result.score} из {result.total} ({pct}%)</h1>
          <p>{pct >= 67
            ? 'Хороший результат. Тема усвоена, можно переходить к следующему тесту.'
            : 'Стоит перечитать материалы по теме. ИИ-ассистент подскажет, с чего начать.'}</p>
        </div>

        <div className="review">
          <h2>Разбор ответов</h2>
          {test.questions.map((q, qi) => (
            <div key={qi} className="review-item">
              <strong>{qi + 1}. {q.text}</strong>
              {q.options.map((o, oi) => {
                const cls = result.correct[qi] === oi ? 'option correct' : answers[qi] === oi ? 'option wrong' : 'option'
                return (
                  <div key={oi} className={cls}><span className="letter">{LETTERS[oi]}</span><span>{o}</span></div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="row">
          <button className="btn" onClick={restart}>Пройти ещё раз</button>
          <Link to="/profile" className="btn secondary">Мои результаты</Link>
        </div>
      </div>
    )
  }

  const q = test.questions[step]
  const picked = answers[step]
  const last = step === total - 1

  const next = async () => {
    if (picked === undefined) return
    if (!last) {
      setStep(step + 1)
      return
    }
    setSending(true)
    try {
      setResult(await api<SubmitResult>(`/tests/${id}/submit`, { method: 'POST', body: { answers } }))
      setSubmitError(null)
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="pill">{test.title}</span>
        <strong>Вопрос {step + 1} из {total}</strong>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + (picked === undefined ? 0 : 1)}>
        <span style={{ width: `${((step + (picked === undefined ? 0 : 1)) / total) * 100}%` }} />
      </div>
      <h1>{q.text}</h1>
      <div className="options">
        {q.options.map((o, oi) => (
          <button
            key={oi}
            className={picked === oi ? 'option selected' : 'option'}
            aria-pressed={picked === oi}
            onClick={() => setAnswers((a) => Object.assign([...a], { [step]: oi }))}
          >
            <span className="letter">{LETTERS[oi]}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      {submitError && <p className="error">{submitError}</p>}
      <div className="quiz-actions">
        {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Назад</button>}
        <button className="btn dark" disabled={picked === undefined || sending} onClick={next}>
          {last ? 'Завершить тест' : 'Следующий вопрос'}<Arrow />
        </button>
      </div>
    </div>
  )
}
