import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, CATEGORIES, formatShortDate, uploadImage, type News } from '../api'
import ImageField, { clipboardImage, pastedImage } from './ImageField'
import { useFetch } from '../useFetch'

type Draft = Omit<News, 'id' | 'created_at'> & { id?: number }

const empty = (): Draft => ({ title: '', summary: '', body: '', image_url: '', category: '', featured: false, published: true })

export default function NewsAdmin() {
  const { data, reload } = useFetch<News[]>('/admin/news')
  const [draft, setDraft] = useState<Draft>(empty)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  // Inline pictures: an image URL on its own line in the text is shown as a picture in the article.
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const bodyFileRef = useRef<HTMLInputElement>(null)
  const [bodyBusy, setBodyBusy] = useState(false)
  const [bodyError, setBodyError] = useState<string | null>(null)

  const insertIntoBody = async (file: File | null | undefined) => {
    if (!file) return
    const el = bodyRef.current
    const at = el ? el.selectionEnd : draft.body.length
    setBodyBusy(true)
    setBodyError(null)
    try {
      const url = await uploadImage(file)
      setDraft((d) => {
        const before = d.body.slice(0, at).replace(/\n*$/, '')
        const after = d.body.slice(at).replace(/^\n*/, '')
        return { ...d, body: `${before}${before ? '\n' : ''}${url}\n${after}` }
      })
    } catch (e) {
      setBodyError((e as Error).message)
    } finally {
      setBodyBusy(false)
    }
  }

  const onBodyPaste = (e: ClipboardEvent) => {
    const f = pastedImage(e)
    if (f) { e.preventDefault(); insertIntoBody(f) }
  }

  const bodyFromClipboard = async () => {
    try {
      const f = await clipboardImage()
      if (f) insertIntoBody(f)
      else setBodyError('В буфере обмена нет картинки.')
    } catch (e) {
      setBodyError((e as Error).message)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (draft.id) await api(`/admin/news/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/news', { method: 'POST', body: draft })
      setNotice(draft.id ? 'Изменения сохранены.' : 'Новость добавлена.')
      setDraft(empty())
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (n: News) => {
    if (!confirm(`Удалить «${n.title}»?`)) return
    await api(`/admin/news/${n.id}`, { method: 'DELETE' })
    if (draft.id === n.id) setDraft(empty())
    reload()
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Новости</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <button className="btn secondary block" onClick={() => { setDraft(empty()); setNotice(null) }}>+ Новая новость</button>
        {data?.map((n) => (
          <div key={n.id} className={`admin-item${draft.id === n.id ? ' current' : ''}`}>
            <div className="admin-item-head">
              <strong>{n.title}</strong>
              <span className={`pill${n.published ? '' : ' pink'}`}>{n.featured ? 'Главная' : n.published ? 'Опубликовано' : 'Черновик'}</span>
            </div>
            <span className="muted">{n.category ? `${n.category} · ` : ''}{formatShortDate(n.created_at)}</span>
            <div className="row">
              <button className="btn dark small" onClick={() => { setDraft(n); setNotice(null); setError(null) }}>Редактировать</button>
              <Link to={`/news/${n.id}`} className="btn ghost small">Открыть</Link>
              <button className="link-btn danger" onClick={() => remove(n)}>Удалить</button>
            </div>
          </div>
        ))}
      </section>

      <form className="editor" onSubmit={save}>
        <div className="editor-head">
          <h2>{draft.id ? 'Редактировать новость' : 'Новая новость'}</h2>
          <span className={`pill${draft.published ? '' : ' pink'}`}>{draft.published ? 'Будет опубликована' : 'Черновик'}</span>
        </div>
        <label>Заголовок<input value={draft.title} onChange={(e) => set('title', e.target.value)} required /></label>
        <div className="field">
          <span className="field-label">Рубрика</span>
          <div className="seg soft" role="group" aria-label="Рубрика">
            {['', ...CATEGORIES].map((c) => (
              <button key={c || 'none'} type="button" className={draft.category === c ? 'active' : ''} aria-pressed={draft.category === c} onClick={() => set('category', c)}>{c || 'Без рубрики'}</button>
            ))}
          </div>
        </div>
        <label>Коротко (показывается в карточке и над текстом)<textarea rows={2} value={draft.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <div className="field">
          <label htmlFor="news-body" className="field-label">Текст</label>
          <div className="row wrap">
            <button type="button" className="btn secondary small" disabled={bodyBusy} onClick={() => bodyFileRef.current?.click()}>Загрузить картинку в текст</button>
            <button type="button" className="btn secondary small" disabled={bodyBusy} onClick={bodyFromClipboard}>Вставить картинку из буфера</button>
            {bodyBusy && <span className="muted">Загружаем…</span>}
          </div>
          <textarea id="news-body" ref={bodyRef} rows={12} value={draft.body} onChange={(e) => set('body', e.target.value)} onPaste={onBodyPaste} />
          <input ref={bodyFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
            onChange={(e) => { insertIntoBody(e.target.files?.[0]); e.target.value = '' }} />
          {bodyError && <span className="error" role="status">{bodyError}</span>}
          <span className="muted small">Картинка встаёт в место курсора отдельной строкой со ссылкой — в статье она покажется изображением. Можно вставить картинку прямо в поле через Ctrl+V (⌘V).</span>
        </div>
        <ImageField value={draft.image_url} onChange={(url) => set('image_url', url)} />
        <label className="check"><input type="checkbox" checked={draft.featured} onChange={(e) => set('featured', e.target.checked)} /> Главная тема (большая карточка на главной)</label>
        <label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} /> Опубликовать на сайте</label>
        <div className="editor-foot">
          <button className="btn" type="submit">{draft.id ? 'Сохранить изменения' : 'Опубликовать'}</button>
          {draft.id && <button className="btn secondary" type="button" onClick={() => setDraft(empty())}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
      </form>
    </div>
  )
}
