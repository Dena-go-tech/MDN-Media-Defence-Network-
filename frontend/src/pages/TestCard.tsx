import { Link } from 'react-router-dom'
import type { TestSummary } from '../api'
import { useLang } from '../i18n'
import { Arrow } from '../ui'

/** Roughly 50 seconds per test question, 15 per survey question. */
export const minutes = (n: number, survey = false) => Math.max(1, Math.round((n * (survey ? 15 : 50)) / 60))

export const surveyDoneKey = (id: number) => `mdn_survey_done_${id}`

export const surveyDone = (id: number) => {
  try {
    return localStorage.getItem(surveyDoneKey(id)) === '1'
  } catch {
    return false
  }
}

export default function TestCard({ t: test }: { t: TestSummary }) {
  const { t, level, questions } = useLang()
  const survey = test.kind === 'survey'
  const done = survey && surveyDone(test.id)
  return (
    <div className={`test-card${survey ? ' survey' : ''}`}>
      <div className="row wrap">
        {survey ? (
          <>
            <span className="pill pink">{t('tests.survey')}</span>
            <span className="pill">{t('tests.anonymous')}</span>
          </>
        ) : test.level && <span className="pill">{level(test.level)}</span>}
      </div>
      <h3>{test.title}</h3>
      {test.description && <p>{test.description}</p>}
      <span className="test-meta">{t('tests.meta', { q: questions(test.question_count), m: minutes(test.question_count, survey) })}</span>
      <Link to={`/tests/${test.id}`} className={`btn block${done ? ' secondary' : ''}`}>
        {survey ? (done ? t('tests.surveyDone') : t('tests.surveyStart')) : t('tests.start')}<Arrow />
      </Link>
    </div>
  )
}

/** Wide card for an anonymous survey (home page and tests page). */
export function SurveyBanner({ s, withDescription = false }: { s: TestSummary; withDescription?: boolean }) {
  const { t, questions } = useLang()
  const done = surveyDone(s.id)
  return (
    <Link to={`/tests/${s.id}`} className="survey-banner">
      <span className="pill">{t('home.surveyTag')}</span>
      <div>
        <h2>{s.title}</h2>
        {withDescription && s.description && <p className="clamp-3">{s.description}</p>}
        <p className="survey-meta">
          {withDescription
            ? t('survey.intro', { q: questions(s.question_count), m: minutes(s.question_count, true) })
            : t('home.surveyText', { m: minutes(s.question_count, true) })}
        </p>
      </div>
      <span className={`btn ${done ? 'secondary' : 'dark'}`}>{done ? t('tests.surveyDone') : t('home.surveyGo')}<Arrow /></span>
    </Link>
  )
}
