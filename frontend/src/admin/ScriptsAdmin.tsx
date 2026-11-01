import { useState, type FormEvent } from 'react'
import { api, type Script, type Verdict } from '../api'
import { useFetch } from '../useFetch'

type Draft = Omit<Script, 'id' | 'created_at'> & { id?: number }

const empty = (): Draft => ({ question: '', answer: '', verdict: 'none', position: 0, published: true })

const VERDICT_OPTIONS: { value: Verdict; label: string }[] = [
  { value: 'none', label: 'Без вердикта' },
  { value: 'verified', label: '✓ Подтверждено (зелёный щит)' },
  { value: 'fake', label: '✕ Фейк (красный щит)' },
  { value: 'doubt', label: '? Не подтверждено (жёлтый вопрос)' },
  { value: 'warning', label: '! Осторожно (жёлтый восклицательный знак)' },
]

export default function ScriptsAdmin() {
  const { data, reload } = useFetch<Script[]>('/admin/scripts')
  const [draft, setDraft] = useState<Draft>(empty)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (draft.id) await api(`/admin/scripts/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/scripts', { method: 'POST', body: draft })
      setNotice(draft.id ? 'Изменения сохранены.' : 'Ответ добавлен.')
      setDraft(empty())
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (s: Script) => {
    if (!confirm(`Удалить вопрос «${s.question}»?`)) return
    await api(`/admin/scripts/${s.id}`, { method: 'DELETE' })
    if (draft.id === s.id) setDraft(empty())
    reload()
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Демо-ответы</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <p className="muted">Используются, только когда ИИ не подключён: ассистент работает в демо-режиме и произносит эти ответы. Если пользователь пишет свой вопрос, выбирается ответ с самым похожим вопросом.</p>
        <button className="btn secondary block" onClick={() => { setDraft(empty()); setNotice(null) }}>+ Новый ответ</button>
        {data?.map((s) => (
          <div key={s.id} className={`admin-item${draft.id === s.id ? ' current' : ''}`}>
            <div className="admin-item-head">
              <strong>{s.question}</strong>
              <span className={`pill${s.published ? '' : ' pink'}`}>{s.published ? 'Показывается' : 'Скрыт'}</span>
            </div>
            <span className="muted">{VERDICT_OPTIONS.find((o) => o.value === s.verdict)?.label.split(' (')[0]}</span>
            <div className="row">
              <button className="btn dark small" onClick={() => { setDraft(s); setNotice(null); setError(null) }}>Редактировать</button>
              <button className="link-btn danger" onClick={() => remove(s)}>Удалить</button>
            </div>
          </div>
        ))}
      </section>

      <form className="editor" onSubmit={save}>
        <div className="editor-head">
          <h2>{draft.id ? 'Редактировать ответ' : 'Новый ответ ассистента'}</h2>
        </div>
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
        <div className="editor-foot">
          <button className="btn" type="submit">Сохранить</button>
          {draft.id && <button className="btn secondary" type="button" onClick={() => setDraft(empty())}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
      </form>
    </div>
  )
}
