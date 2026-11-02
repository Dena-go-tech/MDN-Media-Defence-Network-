import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type PublicTest, type SubmitResult } from '../api'
import { useAuth } from '../auth'
import { useLang } from '../i18n'
import { useFetch } from '../useFetch'
import { Arrow, ICONS, Icon } from '../ui'
import { minutes, surveyDone, surveyDoneKey } from './TestCard'

const LETTERS = 'АБВГДЕЖЗИК'

export default function TestRun() {
  const { id } = useParams()
  const { t } = useLang()
  const { data: test, error, loading } = useFetch<PublicTest>(`/tests/${id}`)

  if (loading) return <p className="muted">{t('common.loading')}</p>
  if (error || !test) return <p className="error">{error ?? t('common.notFound')}</p>
  // Keyed by id so switching between tests starts from a clean state.
  return test.kind === 'survey' ? <SurveyRun key={test.id} test={test} /> : <QuizRun key={test.id} test={test} />
}

function QuizRun({ test }: { test: PublicTest }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    return (
      <div className="quiz">
        <span className="pill">{test.title}</span>
        <h1>{t('run.loginTitle')}</h1>
        <p className="muted">{t('run.loginText')}</p>
        <Link to="/login" className="btn">{t('nav.login')}</Link>
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
          <span className="pill pink">{t('run.result')}</span>
          <h1>{t('common.score', { s: result.score, t: result.total })} ({pct}%)</h1>
          <p>{pct >= 67 ? t('run.good') : t('run.bad')}</p>
        </div>

        <div className="review">
          <h2>{t('run.review')}</h2>
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
          <button className="btn" onClick={restart}>{t('run.again')}</button>
          <Link to="/profile" className="btn secondary">{t('run.myResults')}</Link>
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
      setResult(await api<SubmitResult>(`/tests/${test.id}/submit`, { method: 'POST', body: { answers } }))
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
        <strong>{t('run.question', { n: step + 1, t: total })}</strong>
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
        {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</button>}
        <button className="btn dark" disabled={picked === undefined || sending} onClick={next}>
          {last ? t('run.finish') : t('run.next')}<Arrow />
        </button>
      </div>
    </div>
  )
}

/** Anonymous survey: no account, no right answers; several options may be allowed. */
function SurveyRun({ test }: { test: PublicTest }) {
  const { t, lang, questions } = useLang()
  const total = test.questions.length
  const [stage, setStage] = useState<'intro' | 'run' | 'done'>(() => (surveyDone(test.id) ? 'done' : 'intro'))
  const [justSent, setJustSent] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[][]>(() => test.questions.map(() => []))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (stage === 'intro') {
    return (
      <div className="quiz">
        <span className="pill pink">{t('tests.survey')}</span>
        <h1>{test.title}</h1>
        {test.description && <p className="lede">{test.description}</p>}
        <p className="muted">{t('survey.intro', { q: questions(total), m: minutes(total, true) })}</p>
        <div className="quiz-actions">
          <button className="btn dark" onClick={() => setStage('run')}>{t('survey.begin')}<Arrow /></button>
        </div>
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="quiz-wrap">
        <div className="result-card">
          <span className="pill pink">{t('tests.survey')}</span>
          <h1>{justSent ? t('survey.thanks') : t('survey.done')}</h1>
          <p>{justSent ? t('survey.thanksText') : t('survey.doneText')}</p>
        </div>
        <div className="row wrap">
          <Link to="/tests" className="btn">{t('survey.toTests')}</Link>
          {!justSent && (
            <button className="btn secondary" onClick={() => { setAnswers(test.questions.map(() => [])); setStep(0); setStage('run') }}>
              {t('survey.again')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const q = test.questions[step]
  const picked = answers[step]
  const last = step === total - 1
  const canGo = picked.length > 0 || !!q.optional

  const toggle = (oi: number) =>
    setAnswers((all) => all.map((a, i) => {
      if (i !== step) return a
      if (!q.multiple) return [oi]
      return a.includes(oi) ? a.filter((x) => x !== oi) : [...a, oi].sort((x, y) => x - y)
    }))

  const next = async () => {
    if (!canGo) return
    if (!last) {
      setStep(step + 1)
      return
    }
    setSending(true)
    try {
      await api(`/tests/${test.id}/survey`, { method: 'POST', body: { answers, lang } })
      try { localStorage.setItem(surveyDoneKey(test.id), '1') } catch { /* not remembered in private mode */ }
      setJustSent(true)
      setStage('done')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const done = step + (canGo ? 1 : 0)

  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="pill pink">{test.title}</span>
        <strong>{t('run.question', { n: step + 1, t: total })}</strong>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <h1>{q.text}</h1>
      {(q.multiple || q.optional) && (
        <div className="row wrap">
          {q.multiple && <span className="pill">{t('survey.multiple')}</span>}
          {q.optional && <span className="pill pink">{t('survey.optional')}</span>}
        </div>
      )}
      <div className="options" role={q.multiple ? 'group' : 'radiogroup'} aria-label={q.text}>
        {q.options.map((o, oi) => {
          const on = picked.includes(oi)
          return (
            <button
              key={oi}
              className={`option${on ? ' selected' : ''}${q.multiple ? ' multi' : ''}`}
              role={q.multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => toggle(oi)}
            >
              <span className="letter">{q.multiple ? (on ? <Icon d={ICONS.check} size={18} /> : '') : LETTERS[oi]}</span>
              <span>{o}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="quiz-actions">
        {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</button>}
        <button className="btn dark" disabled={!canGo || sending} onClick={next}>
          {last ? t('survey.send') : picked.length === 0 ? t('survey.skip') : t('run.next')}<Arrow />
        </button>
      </div>
    </div>
  )
}
