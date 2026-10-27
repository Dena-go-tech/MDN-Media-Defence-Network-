import { useState, type FormEvent } from 'react'
import { api, type Question, type Test, type TestSummary } from '../api'
import { useFetch } from '../useFetch'

const emptyQuestion = (): Question => ({ text: '', options: ['', ''], correct: 0 })
const emptyTest = (): Test => ({ title: '', description: '', questions: [emptyQuestion()], published: true })

export default function TestsAdmin() {
  const { data, reload } = useFetch<TestSummary[]>('/admin/tests')
  const [draft, setDraft] = useState<Test | null>(null)
  const [error, setError] = useState<string | null>(null)

  const update = (fn: (t: Test) => void) =>
    setDraft((d) => {
      if (!d) return d
      const copy: Test = structuredClone(d)
      fn(copy)
      return copy
    })

  const edit = async (id: number) => setDraft(await api<Test>(`/admin/tests/${id}`))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    try {
      if (draft.id) await api(`/admin/tests/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/tests', { method: 'POST', body: draft })
      setDraft(null)
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (t: TestSummary) => {
    if (!confirm(`Удалить тест «${t.title}»? Результаты пользователей тоже будут удалены.`)) return
    await api(`/admin/tests/${t.id}`, { method: 'DELETE' })
    reload()
  }

  if (draft) {
    return (
      <form className="admin-form" onSubmit={save}>
        <h2>{draft.id ? 'Редактировать тест' : 'Новый тест'}</h2>
        <label>Название<input value={draft.title} onChange={(e) => update((t) => { t.title = e.target.value })} required /></label>
        <label>Описание<textarea rows={2} value={draft.description} onChange={(e) => update((t) => { t.description = e.target.value })} /></label>
        <label className="check">
          <input type="checkbox" checked={draft.published} onChange={(e) => update((t) => { t.published = e.target.checked })} /> Опубликовано
        </label>

        {draft.questions.map((q, qi) => (
          <fieldset key={qi} className="q-edit">
            <legend>Вопрос {qi + 1}</legend>
            <input placeholder="Текст вопроса" value={q.text} onChange={(e) => update((t) => { t.questions[qi].text = e.target.value })} required />
            {q.options.map((o, oi) => (
              <div key={oi} className="row">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correct === oi}
                  onChange={() => update((t) => { t.questions[qi].correct = oi })}
                  title="Правильный ответ"
                />
                <input placeholder={`Вариант ${oi + 1}`} value={o} onChange={(e) => update((t) => { t.questions[qi].options[oi] = e.target.value })} required />
                {q.options.length > 2 && (
                  <button type="button" className="link-btn danger" onClick={() => update((t) => {
                    const tq = t.questions[qi]
                    tq.options.splice(oi, 1)
                    if (tq.correct >= tq.options.length) tq.correct = 0
                  })}>✕</button>
                )}
              </div>
            ))}
            <div className="row">
              <button type="button" className="link-btn" onClick={() => update((t) => { t.questions[qi].options.push('') })}>+ вариант</button>
              <button type="button" className="link-btn danger" onClick={() => update((t) => { t.questions.splice(qi, 1) })}>Удалить вопрос</button>
            </div>
          </fieldset>
        ))}
        <button type="button" className="btn secondary" onClick={() => update((t) => { t.questions.push(emptyQuestion()) })}>+ Добавить вопрос</button>
        <p className="muted">Отметьте кружком правильный вариант ответа.</p>

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
      <button className="btn" onClick={() => setDraft(emptyTest())}>+ Добавить тест</button>
      <table className="table">
        <thead>
          <tr><th>Название</th><th>Вопросов</th><th>Статус</th><th /></tr>
        </thead>
        <tbody>
          {data?.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.question_count}</td>
              <td>{t.published ? 'Опубликован' : 'Черновик'}</td>
              <td className="actions">
                <button className="link-btn" onClick={() => edit(t.id)}>Изменить</button>
                <button className="link-btn danger" onClick={() => remove(t)}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
