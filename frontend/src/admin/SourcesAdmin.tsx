import { useState, type FormEvent } from 'react'
import { api, CATEGORIES, formatTime, MEDIA_CATEGORY, STATE_CATEGORY, type Source } from '../api'
import { useFetch } from '../useFetch'

type Draft = Pick<Source, 'name' | 'url' | 'feed_url' | 'is_state' | 'import_news' | 'category' | 'enabled'> & { id?: number }

const empty = (): Draft => ({ name: '', url: '', feed_url: '', is_state: false, import_news: false, category: '', enabled: true })

const STATUS: Record<string, { label: string; className: string }> = {
  ok: { label: 'Работает', className: 'pill' },
  error: { label: 'Ошибка', className: 'pill warn' },
  blocked: { label: 'Закрыто robots.txt', className: 'pill pink' },
  pending: { label: 'Ещё не опрашивался', className: 'pill pink' },
}

export default function SourcesAdmin() {
  const { data, reload } = useFetch<Source[]>('/admin/sources')
  const [draft, setDraft] = useState<Draft>(empty)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const edit = (s: Source) => {
    setDraft({ id: s.id, name: s.name, url: s.url, feed_url: s.feed_url, is_state: s.is_state, import_news: s.import_news, category: s.category, enabled: s.enabled })
    setNotice(null)
    setError(null)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (draft.id) await api(`/admin/sources/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/sources', { method: 'POST', body: draft })
      setNotice(draft.id ? 'Изменения сохранены.' : 'Канал добавлен. Лента прочитается при следующем обновлении.')
      setDraft(empty())
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (s: Source) => {
    if (!confirm(`Удалить «${s.name}»? Вместе с каналом удалятся его голоса и история. Уже загруженные новости останутся.`)) return
    await api(`/admin/sources/${s.id}`, { method: 'DELETE' })
    if (draft.id === s.id) setDraft(empty())
    reload()
  }

  const refresh = async () => {
    try {
      await api('/admin/sources/refresh', { method: 'POST' })
      setError(null)
      setNotice('Обновление запущено. Статусы появятся в течение минуты.')
      // Polling runs in the background on the server.
      for (const ms of [5000, 20000, 60000]) setTimeout(reload, ms)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Каналы</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <div className="row wrap">
          <button className="btn secondary small" onClick={() => { setDraft(empty()); setNotice(null) }}>+ Новый канал</button>
          <button className="btn secondary small" onClick={refresh}>Обновить ленты сейчас</button>
        </div>
        {data?.map((s) => {
          const status = STATUS[s.last_status] ?? STATUS.pending
          return (
            <div key={s.id} className={`admin-item${draft.id === s.id ? ' current' : ''}`}>
              <div className="admin-item-head">
                <strong>{s.name}</strong>
                <span className={status.className}>{s.enabled ? status.label : 'Выключен'}</span>
              </div>
              <span className="muted small">
                {s.is_state ? 'Госканал · ' : ''}{s.import_news ? 'Загружает новости · ' : ''}{s.posts_7d} публ. за 7 дней
                {s.last_fetch_at ? ` · опрошен ${formatTime(s.last_fetch_at)}` : ''}
              </span>
              {s.last_error && <span className="error small">{s.last_error}</span>}
              <div className="row">
                <button className="btn dark small" onClick={() => edit(s)}>Редактировать</button>
                <button className="link-btn danger" onClick={() => remove(s)}>Удалить</button>
              </div>
            </div>
          )
        })}
      </section>

      <form className="editor" onSubmit={save}>
        <div className="editor-head">
          <h2>{draft.id ? 'Редактировать канал' : 'Новый канал'}</h2>
        </div>
        <p className="muted small">Канал участвует в рейтинге. Лента опрашивается каждые 30 минут; если robots.txt сайта запрещает её читать, платформа её не читает и покажет статус в списке.</p>
        <label>Название<input value={draft.name} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Адрес RSS- или Atom-ленты либо sitemap<input type="url" value={draft.feed_url} onChange={(e) => set('feed_url', e.target.value)} required placeholder="https://example.kg/feed/" /></label>
        <label>Сайт (необязательно)<input type="url" value={draft.url} onChange={(e) => set('url', e.target.value)} placeholder="https://example.kg/" /></label>
        <label className="check"><input type="checkbox" checked={draft.is_state} onChange={(e) => set('is_state', e.target.checked)} /> Государственный канал</label>
        <label className="check"><input type="checkbox" checked={draft.import_news} onChange={(e) => set('import_news', e.target.checked)} /> Загружать в новости (заголовок, около 70% текста, ссылка на оригинал)</label>
        {draft.import_news && (
          <div className="field">
            <span className="field-label">Рубрика загруженных новостей</span>
            <div className="seg soft" role="group" aria-label="Рубрика">
              {[STATE_CATEGORY, MEDIA_CATEGORY, ...CATEGORIES].map((c) => (
                <button key={c} type="button" className={draft.category === c ? 'active' : ''} aria-pressed={draft.category === c} onClick={() => set('category', c)}>{c}</button>
              ))}
            </div>
            <span className="muted small">Загрузятся записи, которые сейчас есть в ленте, и все новые.</span>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Включён (опрашивается и виден в рейтинге)</label>
        <div className="editor-foot">
          <button className="btn" type="submit">{draft.id ? 'Сохранить изменения' : 'Добавить канал'}</button>
          {draft.id && <button className="btn secondary" type="button" onClick={() => setDraft(empty())}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
      </form>
    </div>
  )
}
