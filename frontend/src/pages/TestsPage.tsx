import type { TestSummary } from '../api'
import { useLang } from '../i18n'
import { useFetch } from '../useFetch'
import TestCard, { SurveyBanner } from './TestCard'

export default function TestsPage() {
  const { t } = useLang()
  const { data, error, loading } = useFetch<TestSummary[]>('/tests')

  if (loading) return <p className="muted">{t('common.loading')}</p>
  if (error) return <p className="error">{error}</p>

  const surveys = (data ?? []).filter((x) => x.kind === 'survey')
  const quizzes = (data ?? []).filter((x) => x.kind !== 'survey')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('tests.title')}</h1>
          <p className="lede">{t('tests.lede')}</p>
        </div>
      </div>
      {data?.length === 0 && <div className="empty">{t('tests.empty')}</div>}

      {surveys.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>{t('tests.surveys')}</h2>
              <p className="muted">{t('tests.surveysLede')}</p>
            </div>
          </div>
          <div className="survey-list">
            {surveys.map((x) => <SurveyBanner key={x.id} s={x} withDescription />)}
          </div>
        </section>
      )}

      {quizzes.length > 0 && (
        <section className="section">
          {surveys.length > 0 && <div className="section-head"><h2>{t('tests.quizzes')}</h2></div>}
          <div className="test-grid">
            {quizzes.map((x) => <TestCard key={x.id} t={x} />)}
          </div>
        </section>
      )}
    </>
  )
}
