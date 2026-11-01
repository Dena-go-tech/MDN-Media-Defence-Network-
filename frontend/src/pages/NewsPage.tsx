import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryColor, formatDate, formatShortDate, readMinutes, type News, type Script, type TestSummary } from '../api'
import { useFetch } from '../useFetch'
import { Arrow, ICONS, Icon } from '../ui'
import TestCard from './TestCard'

const QUICK_QUESTIONS = ['Закон о СМИ', 'Цифровая безопасность', 'Что делать при давлении']

const VERDICT_LABELS: Record<string, { label: string; className: string }> = {
  verified: { label: 'Вердикт: подтверждено', className: 'verdict ok' },
  fake: { label: 'Вердикт: фейк', className: 'verdict bad' },
  doubt: { label: 'Вердикт: не подтверждено', className: 'verdict warn' },
  warning: { label: 'Вердикт: осторожно', className: 'verdict warn' },
}

function NewsCard({ n }: { n: News }) {
  return (
    <Link to={`/news/${n.id}`} className="card">
      <div className="card-media">{n.image_url && <img src={n.image_url} alt="" />}</div>
      <div className="card-body">
        {n.category && <span className="pill tag" style={{ background: categoryColor(n.category) }}>{n.category}</span>}
        <h3>{n.title}</h3>
        <div className="card-meta">
          <span>{formatShortDate(n.created_at)} · {readMinutes(n.body)} мин</span>
          {n.summary && <span className="pill">Кратко</span>}
        </div>
      </div>
    </Link>
  )
}

export default function NewsPage() {
  const news = useFetch<News[]>('/news')
  const tests = useFetch<TestSummary[]>('/tests')
  const scripts = useFetch<Script[]>('/assistant/scripts')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('Все')

  const ask = (q: string) => navigate(`/assistant?q=${encodeURIComponent(q)}`)
  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) ask(query.trim())
  }

  const list = news.data ?? []
  const featured = list.find((n) => n.featured) ?? list[0]
  const rest = list.filter((n) => n !== featured)
  const cats = [...new Set(rest.map((n) => n.category).filter(Boolean))]
  const shown = cat === 'Все' ? rest : rest.filter((n) => n.category === cat)
  const example = scripts.data?.[0]

  return (
    <>
      <section className="intro">
        <span className="pill dot">Информационный портал для медиа</span>
        <h1>Знайте свои права. Проверяйте знания. <em>Защищайте слово.</em></h1>
        <p>Новости о свободе слова и медиаправе, короткие тесты для журналистов и редакций и ИИ-ассистент, который отвечает со ссылкой на источник.</p>
        <form className="searchbar" onSubmit={onSearch} role="search">
          <Icon d={ICONS.search} size={22} />
          <input
            aria-label="Проверить новость или задать вопрос"
            placeholder="Проверить новость или задать вопрос о медиаправе"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn dark" type="submit">Спросить</button>
        </form>
        <div className="chips">
          {QUICK_QUESTIONS.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)}>{q}</button>)}
        </div>
      </section>

      {news.loading && <p className="muted">Загрузка…</p>}
      {news.error && <p className="error">{news.error}</p>}

      {featured ? (
        <Link to={`/news/${featured.id}`} className="feature">
          <div className="feature-media">{featured.image_url && <img src={featured.image_url} alt="" />}</div>
          <div className="feature-body">
            <span className="pill pink">{featured.featured ? 'Главная тема' : 'Свежее'}</span>
            <h2>{featured.title}</h2>
            {featured.summary && <p>{featured.summary}</p>}
            <div className="feature-meta">
              <span>{formatDate(featured.created_at)} · {readMinutes(featured.body)} мин чтения</span>
              <span className="btn light">Читать<Arrow /></span>
            </div>
          </div>
        </Link>
      ) : (
        !news.loading && <div className="empty">Новостей пока нет. Добавьте первую через админку.</div>
      )}

      {rest.length > 0 && (
        <section id="news" className="section">
          <div className="section-head">
            <h2>Новости</h2>
            {cats.length > 0 && (
              <div className="seg" role="group" aria-label="Рубрики">
                {['Все', ...cats].map((c) => (
                  <button key={c} type="button" className={cat === c ? 'active' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid">
            {shown.map((n) => <NewsCard key={n.id} n={n} />)}
          </div>
        </section>
      )}

      {!!tests.data?.length && (
        <section id="tests" className="dark-block">
          <div className="dark-block-head">
            <div>
              <h2>Тесты и самопроверка</h2>
              <p>Каждый пройденный тест сохраняется в вашем профиле и попадает в аналитику сети: так редакции и тренеры видят, какие темы требуют внимания.</p>
            </div>
            <ol className="steps">
              <li><span>1</span>Проходите тест</li>
              <li><span>2</span>Результат уходит в аналитику</li>
              <li><span>3</span>Разбор ошибок сразу после теста</li>
            </ol>
          </div>
          <div className="test-grid">
            {tests.data.slice(0, 3).map((t) => <TestCard key={t.id} t={t} />)}
          </div>
          {tests.data.length > 3 && <Link to="/tests" className="btn light more">Все тесты<Arrow /></Link>}
        </section>
      )}

      <section className="promo">
        <div className="promo-text">
          <span className="pill pink">ИИ-ассистент BulbAI</span>
          <h2>Проверит новость или сообщение до того, как вы её перешлёте</h2>
          <p>Ассистент разбирает слухи, подозрительные SMS и фото, пересказывает новости и объясняет ошибки в тестах. Это подсказка, а не окончательный вердикт.</p>
          <Link to="/assistant" className="btn dark">Открыть ассистента<Arrow /></Link>
        </div>
        <div className="chat-preview">
          {example && (
            <>
              <div className="bubble user">{example.question}</div>
              <div className="bubble assistant">
                <p>{example.answer.split('\n')[0]}</p>
                {VERDICT_LABELS[example.verdict] && (
                  <span className={VERDICT_LABELS[example.verdict].className}>{VERDICT_LABELS[example.verdict].label}</span>
                )}
              </div>
            </>
          )}
          <form className="mini-input" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get('q'); if (v) ask(String(v)) }}>
            <input name="q" aria-label="Ваш вопрос" placeholder="Вставьте новость, сообщение или ссылку" />
            <button className="icon-btn" type="submit" aria-label="Отправить"><Arrow /></button>
          </form>
          <span className="muted small">ИИ может ошибаться. Проверяйте важное по первоисточнику.</span>
        </div>
      </section>
    </>
  )
}
