import { useState, type FormEvent } from 'react'
import { api, formatDate, type News } from '../api'
import { useFetch } from '../useFetch'

type Draft = Omit<News, 'id' | 'created_at'> & { id?: number }

const empty: Draft = { title: '', summary: '', body: '', image_url: '', featured: false, published: true }

export default function NewsAdmin() {
  const { data, reload } = useFetch<News[]>('/admin/news')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => d && { ...d, [k]: v })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    try {
      if (draft.id) await api(`/admin/news/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/news', { method: 'POST', body: draft })
      setDraft(null)
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (n: News) => {
    if (!confirm(`Удалить «${n.title}»?`)) return
    await api(`/admin/news/${n.id}`, { method: 'DELETE' })
    reload()
  }

  if (draft) {
    return (
      <form className="admin-form" onSubmit={save}>
        <h2>{draft.id ? 'Редактировать новость' : 'Новая новость'}</h2>
        <label>Заголовок<input value={draft.title} onChange={(e) => set('title', e.target.value)} required /></label>
        <label>Краткое описание<textarea rows={2} value={draft.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <label>Текст<textarea rows={10} value={draft.body} onChange={(e) => set('body', e.target.value)} /></label>
        <label>URL изображения<input value={draft.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" /></label>
        <label className="check"><input type="checkbox" checked={draft.featured} onChange={(e) => set('featured', e.target.checked)} /> Главная новость (баннер на главной)</label>
        <label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} /> Опубликовано</label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn" type="submit">Сохранить</button>
          <button className="btn secondary" type="button" onClick={() => setDraft(null)}>Отмена</button>
        </div>
      </form>
    )
  }

  return (
    <>
      <button className="btn" onClick={() => setDraft({ ...empty })}>+ Добавить новость</button>
      <table className="table">
        <thead>
          <tr><th>Заголовок</th><th>Статус</th><th>Дата</th><th /></tr>
        </thead>
        <tbody>
          {data?.map((n) => (
            <tr key={n.id}>
              <td>{n.featured && '★ '}{n.title}</td>
              <td>{n.published ? 'Опубликовано' : 'Черновик'}</td>
              <td>{formatDate(n.created_at)}</td>
              <td className="actions">
                <button className="link-btn" onClick={() => setDraft(n)}>Изменить</button>
                <button className="link-btn danger" onClick={() => remove(n)}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
