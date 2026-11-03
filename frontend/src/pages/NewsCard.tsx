import { Link } from 'react-router-dom'
import { categoryColor, formatShortDate, readMinutes, type News } from '../api'
import { useLang } from '../i18n'

export default function NewsCard({ n }: { n: News }) {
  const { t, category } = useLang()
  return (
    <Link to={`/news/${n.id}`} className="card">
      {n.image_url && <div className="card-media"><img src={n.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" /></div>}
      <div className="card-body">
        {n.category && <span className="pill tag" style={{ background: categoryColor(n.category) }}>{category(n.category)}</span>}
        <h3>{n.title}</h3>
        <div className="card-meta">
          <span>{formatShortDate(n.created_at)} · {n.source_name || `${readMinutes(n.body)} ${t('common.min')}`}</span>
          {n.summary && <span className="pill">{t('common.summary')}</span>}
        </div>
      </div>
    </Link>
  )
}
