import { useState, type FormEvent } from 'react'
import { api, type Script, type Verdict } from '../api'
import { useFetch } from '../useFetch'

type Draft = Omit<Script, 'id' | 'created_at'> & { id?: number }

const empty: Draft = { question: '', answer: '', verdict: 'none', position: 0, published: true }

const VERDICT_OPTIONS: { value: Verdict; label: string }[] = [
  { value: 'none', label: 'Без вердикта' },
  { value: 'verified', label: '✓ Подтверждено (зелёный щит)' },
  { value: 'fake', label: '✕ Фейк (красный щит)' },
  { value: 'doubt', label: '? Не подтверждено (жёлтый вопрос)' },
  { value: 'warning', label: '! Осторожно (жёлтый восклицательный знак)' },
]

export default function ScriptsAdmin() {
  const { data, reload } = useFetch<Script[]>('/admin/scripts')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => d && { ...d, [k]: v })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    try {
      if (draft.id) await api(`/admin/scripts/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/scripts', { method: 'POST', body: draft })
      setDraft(null)
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (s: Script) => {
    if (!confirm(`Удалить вопрос «${s.question}»?`)) return
    await api(`/admin/scripts/${s.id}`, { method: 'DELETE' })
    reload()
  }

  if (draft) {
    return (
      <form className="admin-form" onSubmit={save}>
        <h2>{draft.id ? 'Редактировать ответ ассистента' : 'Новый ответ ассистента'}</h2>
        <label>Вопрос пользователя (показывается кнопкой на странице ассистента)
          <textarea rows={2} value={draft.question} onChange={(e) => set('question', e.target.value)} required />
        </label>
        <label>Что говорит ассистент
          <textarea rows={8} value={draft.answer} onChange={(e) => set('answer', e.target.value)} required />
        </label>
        <label>Вердикт на щите лампочки
          <select value={draft.verdict} onChange={(e) => set('verdict', e.target.value as Verdict)}>
            {VERDICT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>Порядок (меньше — выше)
          <input type="number" value={draft.position} onChange={(e) => set('position', Number(e.target.value))} />
        </label>
        <label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} /> Показывать на сайте</label>
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
      <p className="muted">Пока ИИ не подключён, ассистент работает в демо-режиме и произносит эти ответы. Если пользователь пишет свой вопрос, выбирается ответ с самым похожим вопросом.</p>
      <button className="btn" onClick={() => setDraft({ ...empty })}>+ Добавить ответ</button>
      <table className="table">
        <thead>
          <tr><th>Вопрос</th><th>Вердикт</th><th>Статус</th><th /></tr>
        </thead>
        <tbody>
          {data?.map((s) => (
            <tr key={s.id}>
              <td>{s.question}</td>
              <td>{VERDICT_OPTIONS.find((o) => o.value === s.verdict)?.label.split(' (')[0]}</td>
              <td>{s.published ? 'Показывается' : 'Скрыт'}</td>
              <td className="actions">
                <button className="link-btn" onClick={() => setDraft(s)}>Изменить</button>
                <button className="link-btn danger" onClick={() => remove(s)}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
