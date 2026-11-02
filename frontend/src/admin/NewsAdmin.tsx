import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, CATEGORIES, formatShortDate, uploadImage, type News, type NewsText } from '../api'
import ImageField, { clipboardImage, pastedImage } from './ImageField'
import { useFetch } from '../useFetch'
import I18nField, { type EditLang } from './LangTabs'

type Draft = Omit<News, 'id' | 'created_at' | 'ky'> & { id?: number; ky: NewsText }

const emptyKY = (): NewsText => ({ title: '', summary: '', body: '' })
const empty = (): Draft => ({ title: '', summary: '', body: '', image_url: '', category: '', featured: false, published: true, ky: emptyKY() })
const toDraft = (n: News): Draft => ({ ...n, ky: { ...emptyKY(), ...n.ky } })

export default function NewsAdmin() {
  const { data, reload } = useFetch<News[]>('/admin/news')
  const [draft, setDraft] = useState<Draft>(empty)
  // Which language of the body is shown: pictures are inserted into that version.
  const [bodyLang, setBodyLang] = useState<EditLang>('ru')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setKY = (k: keyof NewsText, v: string) => setDraft((d) => ({ ...d, ky: { ...d.ky, [k]: v } }))
  const body = bodyLang === 'ky' ? draft.ky.body : draft.body
  const reset = () => { setDraft(empty()); setBodyLang('ru') }

  // Inline pictures: an image URL on its own line in the text is shown as a picture in the article.
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const bodyFileRef = useRef<HTMLInputElement>(null)
  const [bodyBusy, setBodyBusy] = useState(false)
  const [bodyError, setBodyError] = useState<string | null>(null)

  const insertIntoBody = async (file: File | null | undefined) => {
    if (!file) return
    const el = bodyRef.current
    const at = el ? el.selectionEnd : body.length
    const into = bodyLang
    setBodyBusy(true)
    setBodyError(null)
    try {
      const url = await uploadImage(file)
      setDraft((d) => {
        const text = into === 'ky' ? d.ky.body : d.body
        const before = text.slice(0, at).replace(/\n*$/, '')
        const after = text.slice(at).replace(/^\n*/, '')
        const next = `${before}${before ? '\n' : ''}${url}\n${after}`
        return into === 'ky' ? { ...d, ky: { ...d.ky, body: next } } : { ...d, body: next }
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
      reset()
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (n: News) => {
    if (!confirm(`Удалить «${n.title}»?`)) return
    await api(`/admin/news/${n.id}`, { method: 'DELETE' })
    if (draft.id === n.id) reset()
    reload()
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Новости</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <button className="btn secondary block" onClick={() => { reset(); setNotice(null) }}>+ Новая новость</button>
        {data?.map((n) => (
          <div key={n.id} className={`admin-item${draft.id === n.id ? ' current' : ''}`}>
            <div className="admin-item-head">
              <strong>{n.title}</strong>
              <span className={`pill${n.published ? '' : ' pink'}`}>{n.featured ? 'Главная' : n.published ? 'Опубликовано' : 'Черновик'}</span>
            </div>
            <span className="muted">{n.category ? `${n.category} · ` : ''}{formatShortDate(n.created_at)}{n.ky?.title ? ' · KG ✓' : ''}</span>
            <div className="row">
              <button className="btn dark small" onClick={() => { setDraft(toDraft(n)); setNotice(null); setError(null) }}>Редактировать</button>
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
        <p className="muted small">Поля с переключателем <strong>RU | KG</strong> переводятся. Пустой кыргызский перевод на сайте покажется по-русски.</p>
        <I18nField id="news-title" label="Заголовок" ru={draft.title} ky={draft.ky.title} onRu={(v) => set('title', v)} onKy={(v) => setKY('title', v)} required />
        <div className="field">
          <span className="field-label">Рубрика</span>
          <div className="seg soft" role="group" aria-label="Рубрика">
            {['', ...CATEGORIES].map((c) => (
              <button key={c || 'none'} type="button" className={draft.category === c ? 'active' : ''} aria-pressed={draft.category === c} onClick={() => set('category', c)}>{c || 'Без рубрики'}</button>
            ))}
          </div>
        </div>
        <I18nField
          id="news-summary"
          label="Коротко (показывается в карточке и над текстом)"
          multiline
          rows={2}
          ru={draft.summary}
          ky={draft.ky.summary}
          onRu={(v) => set('summary', v)}
          onKy={(v) => setKY('summary', v)}
        />
        <I18nField
          id="news-body"
          label="Текст"
          multiline
          rows={12}
          ru={draft.body}
          ky={draft.ky.body}
          onRu={(v) => set('body', v)}
          onKy={(v) => setKY('body', v)}
          lang={bodyLang}
          onLang={setBodyLang}
          inputRef={bodyRef}
          onPaste={onBodyPaste}
          toolbar={
            <div className="row wrap">
              <button type="button" className="btn secondary small" disabled={bodyBusy} onClick={() => bodyFileRef.current?.click()}>Загрузить картинку в текст</button>
              <button type="button" className="btn secondary small" disabled={bodyBusy} onClick={bodyFromClipboard}>Вставить картинку из буфера</button>
              {bodyBusy && <span className="muted">Загружаем…</span>}
            </div>
          }
          hint={
            <>
              <input ref={bodyFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
                onChange={(e) => { insertIntoBody(e.target.files?.[0]); e.target.value = '' }} />
              {bodyError && <span className="error" role="status">{bodyError}</span>}
              <span className="muted small">Картинка встаёт в место курсора отдельной строкой со ссылкой — в статье она покажется изображением. Можно вставить картинку прямо в поле через Ctrl+V (⌘V). Вставляется в ту версию текста (RU или KG), которая сейчас открыта.</span>
            </>
          }
        />
        <ImageField value={draft.image_url} onChange={(url) => set('image_url', url)} />
        <label className="check"><input type="checkbox" checked={draft.featured} onChange={(e) => set('featured', e.target.checked)} /> Главная тема (большая карточка на главной)</label>
        <label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} /> Опубликовать на сайте</label>
        <div className="editor-foot">
          <button className="btn" type="submit">{draft.id ? 'Сохранить изменения' : 'Опубликовать'}</button>
          {draft.id && <button className="btn secondary" type="button" onClick={reset}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
      </form>
    </div>
  )
}
