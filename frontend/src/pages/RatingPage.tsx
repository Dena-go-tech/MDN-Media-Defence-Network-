import { Link } from 'react-router-dom'
import { formatTime, type Rating, type RatingRow } from '../api'
import { useAuth } from '../auth'
import { useLang, type TKey } from '../i18n'
import { useFetch } from '../useFetch'
import { ICONS, Icon } from '../ui'
import { useVote } from './SourceVote'

const STATUS_NOTE: Record<string, TKey | undefined> = {
  blocked: 'rating.statusBlocked',
  error: 'rating.statusError',
  pending: 'rating.statusPending',
}

function Metrics({ row }: { row: RatingRow }) {
  const { t } = useLang()
  const note = STATUS_NOTE[row.status]
  // A failed poll keeps the numbers measured earlier; a closed or new feed has none.
  const measured = row.status === 'ok' || row.status === 'error'
  return (
    <div className="rating-metrics">
      {measured && (
        <>
          <span>{t('rating.activity', { n: row.activity })}</span>
          <span>{t('rating.posts', { n: row.posts_7d })}</span>
          {row.last_post_at && <span>{t('rating.lastPost', { d: formatTime(row.last_post_at) })}</span>}
          <span>{t('rating.availability', { n: row.availability })}</span>
        </>
      )}
      {note && <span className={row.status === 'error' ? 'rating-note warn' : 'rating-note'}>{t(note)}</span>}
    </div>
  )
}

export default function RatingPage() {
  const { t, votes } = useLang()
  const { user } = useAuth()
  const { data, error, loading, reload } = useFetch<Rating>('/rating')
  const { busy, voteError, vote, unvote } = useVote(reload)

  // Keeps the list on screen while it reloads after a vote.
  if (!data && loading) return <p className="muted">{t('common.loading')}</p>
  if (!data) return <p className="error">{error ?? t('common.notFound')}</p>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('rating.title')}</h1>
          <p className="lede">{t('rating.lede')}</p>
        </div>
        <span className="pill">{votes(data.total_votes)}</span>
      </div>

      {!user && (
        <div className="rating-login">
          <span>{t('rating.loginHint')}</span>
          <Link to="/login" className="btn dark small">{t('nav.login')}</Link>
        </div>
      )}
      {voteError && <p className="error" role="alert">{voteError}</p>}

      {data.rows.length === 0 ? (
        <div className="empty">{t('rating.empty')}</div>
      ) : (
        <ol className="rating-list">
          {data.rows.map((row) => {
            const mine = data.my_vote === row.id
            const share = data.total_votes ? Math.round((row.votes / data.total_votes) * 100) : 0
            return (
              <li key={row.id} className={`rating-row${mine ? ' mine' : ''}`}>
                <span className="rating-rank" aria-hidden="true">{row.rank}</span>
                <div className="rating-main">
                  <div className="rating-title">
                    <h2><a href={row.url} target="_blank" rel="noopener noreferrer">{row.name}</a></h2>
                    {row.is_state && <span className="pill">{t('rating.state')}</span>}
                  </div>
                  <div className="rating-votes">
                    <strong>{votes(row.votes)}</strong>
                    <div className="bar-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
                    <span className="muted small">{share}%</span>
                  </div>
                  <Metrics row={row} />
                </div>
                {user && (
                  mine ? (
                    <button type="button" className="btn secondary small rating-vote" disabled={busy} aria-pressed="true" onClick={unvote}>
                      <Icon d={ICONS.check} size={16} />{t('rating.unvote')}
                    </button>
                  ) : (
                    <button type="button" className="btn small rating-vote" disabled={busy} onClick={() => vote(row.id)}>
                      {data.my_vote ? t('rating.move') : t('rating.vote')}
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ol>
      )}

      <section className="rating-method">
        <h2>{t('rating.methodTitle')}</h2>
        <p>{t('rating.method1')}</p>
        <p>{t('rating.method2')}</p>
        {data.updated_at && <p className="muted small">{t('rating.updated', { d: formatTime(data.updated_at) })}</p>}
      </section>
    </>
  )
}
