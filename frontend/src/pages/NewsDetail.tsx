import { Link, useParams } from 'react-router-dom'
import { formatDate, type News } from '../api'
import { useFetch } from '../useFetch'

export default function NewsDetail() {
  const { id } = useParams()
  const { data, error, loading } = useFetch<News>(`/news/${id}`)

  if (loading) return <p className="muted">Загрузка…</p>
  if (error || !data) return <p className="error">{error ?? 'Не найдено'}</p>

  return (
    <article className="article">
      <Link to="/" className="link">← Все новости</Link>
      <h1>{data.title}</h1>
      <span className="muted">{formatDate(data.created_at)}</span>
      {data.image_url && <img src={data.image_url} alt="" />}
      {data.summary && <p className="lead">{data.summary}</p>}
      {data.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
    </article>
  )
}
