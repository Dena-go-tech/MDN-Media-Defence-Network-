import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type PublicTest, type SubmitResult } from '../api'
import { useAuth } from '../auth'
import { useFetch } from '../useFetch'

export default function TestRun() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: test, error, loading } = useFetch<PublicTest>(`/tests/${id}`)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !test) return <p className="error">{error ?? 'Не найдено'}</p>

  const allAnswered = test.questions.every((_, i) => answers[i] !== undefined)

  const submit = async () => {
    try {
      setResult(await api<SubmitResult>(`/tests/${id}/submit`, { method: 'POST', body: { answers } }))
    } catch (e) {
      setSubmitError((e as Error).message)
    }
  }

  const optionClass = (qi: number, oi: number) => {
    if (!result) return answers[qi] === oi ? 'option selected' : 'option'
    if (result.correct[qi] === oi) return 'option correct'
    if (answers[qi] === oi) return 'option wrong'
    return 'option'
  }

  return (
    <div className="test-run">
      <Link to="/tests" className="link">← Все тесты</Link>
      <h1>{test.title}</h1>
      <p className="muted">{test.description}</p>

      {test.questions.map((q, qi) => (
        <div key={qi} className="question">
          <h3>{qi + 1}. {q.text}</h3>
          {q.options.map((o, oi) => (
            <button
              key={oi}
              className={optionClass(qi, oi)}
              disabled={!!result}
              onClick={() => setAnswers((a) => Object.assign([...a], { [qi]: oi }))}
            >
              {o}
            </button>
          ))}
        </div>
      ))}

      {result ? (
        <div className="result">
          Ваш результат: <strong>{result.score} из {result.total}</strong>
          <Link to="/profile" className="link">Смотреть в профиле →</Link>
        </div>
      ) : user ? (
        <button className="btn" disabled={!allAnswered} onClick={submit}>Отправить ответы</button>
      ) : (
        <div className="result">
          <span><Link to="/login" className="link">Войдите</Link>, чтобы пройти тест и сохранить результат.</span>
        </div>
      )}
      {submitError && <p className="error">{submitError}</p>}
    </div>
  )
}
