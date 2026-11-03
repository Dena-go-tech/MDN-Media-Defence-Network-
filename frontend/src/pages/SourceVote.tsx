import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Rating } from '../api'
import { useAuth } from '../auth'
import { useLang } from '../i18n'
import { useFetch } from '../useFetch'
import { ICONS, Icon } from '../ui'

/** Casting, moving and cancelling the user's single vote. */
export function useVote(onChange: () => void) {
  const [busy, setBusy] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  const send = async (init: { method: string; body?: unknown }) => {
    setBusy(true)
    setVoteError(null)
    try {
      await api('/rating/vote', init)
      onChange()
    } catch (e) {
      setVoteError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    voteError,
    vote: (sourceId: number) => send({ method: 'PUT', body: { source_id: sourceId } }),
    unvote: () => send({ method: 'DELETE' }),
  }
}

/** The vote for a channel, shown under a news item imported from it. */
export default function SourceVote({ sourceId, name }: { sourceId: number; name: string }) {
  const { t, votes } = useLang()
  const { user } = useAuth()
  const { data, reload } = useFetch<Rating>('/rating')
  const { busy, voteError, vote, unvote } = useVote(reload)

  const row = data?.rows.find((r) => r.id === sourceId)
  // A channel switched off in the admin panel is not in the rating and cannot be voted for.
  if (!data || !row) return null

  const mine = data.my_vote === sourceId
  const other = data.rows.find((r) => r.id === data.my_vote)

  return (
    <div className="source-vote">
      <strong>{t('vote.title', { name })}</strong>
      <span className="muted small">{t('vote.place', { place: row.rank, votes: votes(row.votes) })}</span>
      <div className="row">
        {!user ? (
          <Link to="/login" className="btn small">{t('vote.login')}</Link>
        ) : mine ? (
          <button type="button" className="btn secondary small" disabled={busy} aria-pressed="true" onClick={unvote}>
            <Icon d={ICONS.check} size={16} />{t('rating.unvote')}
          </button>
        ) : (
          <button type="button" className="btn small" disabled={busy} onClick={() => vote(sourceId)}>
            {other ? t('vote.move', { from: other.name, name }) : t('vote.give', { name })}
          </button>
        )}
        <Link to="/rating" className="text-link">{t('vote.all')}</Link>
      </div>
      {voteError && <span className="error" role="alert">{voteError}</span>}
    </div>
  )
}
