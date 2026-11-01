import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, LEVELS, type Question, type Test, type TestSummary } from '../api'
import { useFetch } from '../useFetch'
import { ICONS, Icon } from '../ui'

const emptyQuestion = (): Question => ({ text: '', options: ['', ''], correct: 0 })
const emptyTest = (): Test => ({ title: '', description: '', level: LEVELS[0], questions: [emptyQuestion()], published: true })

export default function TestsAdmin() {
  const { data, reload } = useFetch<TestSummary[]>('/admin/tests')
  const [draft, setDraft] = useState<Test>(emptyTest)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const update = (fn: (t: Test) => void) =>
    setDraft((d) => {
      const copy: Test = structuredClone(d)
      fn(copy)
      return copy
    })

  const edit = async (id: number) => {
    setDraft(await api<Test>(`/admin/tests/${id}`))
    setError(null)
    setNotice(null)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (draft.id) await api(`/admin/tests/${draft.id}`, { method: 'PUT', body: draft })
      else await api('/admin/tests', { method: 'POST', body: draft })
      setNotice(draft.id ? 'Изменения сохранены.' : 'Тест создан и появился в списке.')
      setDraft(emptyTest())
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (t: TestSummary) => {
    if (!confirm(`Удалить тест «${t.title}»? Результаты пользователей тоже будут удалены.`)) return
    await api(`/admin/tests/${t.id}`, { method: 'DELETE' })
    if (draft.id === t.id) setDraft(emptyTest())
    reload()
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Все тесты</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <button className="btn secondary block" onClick={() => { setDraft(emptyTest()); setNotice(null) }}>+ Новый тест</button>
        {data?.map((t) => (
          <div key={t.id} className={`admin-item${draft.id === t.id ? ' current' : ''}`}>
            <div className="admin-item-head">
              <strong>{t.title}</strong>
              <span className={`pill${t.published ? '' : ' pink'}`}>{t.published ? 'Опубликован' : 'Черновик'}</span>
            </div>
            <span className="muted">{t.level ? `${t.level} · ` : ''}{t.question_count} вопросов</span>
            <div className="row">
              <button className="btn dark small" onClick={() => edit(t.id)}>Редактировать</button>
              <Link to={`/tests/${t.id}`} className="btn ghost small">Открыть</Link>
              <button className="link-btn danger" onClick={() => remove(t)}>Удалить</button>
            </div>
          </div>
        ))}
      </section>

      <form className="editor" onSubmit={save}>
        <div className="editor-head">
          <h2>{draft.id ? 'Редактировать тест' : 'Новый тест'}</h2>
          <span className={`pill${draft.published ? '' : ' pink'}`}>{draft.published ? 'Будет опубликован' : 'Черновик'}</span>
        </div>

        <label>Название теста
          <input value={draft.title} onChange={(e) => update((t) => { t.title = e.target.value })} placeholder="Например: Проверка фактов" required />
        </label>
        <label>Описание
          <textarea rows={2} value={draft.description} onChange={(e) => update((t) => { t.description = e.target.value })} placeholder="О чём тест и для кого" />
        </label>
        <div className="field">
          <span className="field-label">Уровень</span>
          <div className="seg soft" role="group" aria-label="Уровень">
            {LEVELS.map((l) => (
              <button key={l} type="button" className={draft.level === l ? 'active' : ''} aria-pressed={draft.level === l} onClick={() => update((t) => { t.level = l })}>{l}</button>
            ))}
          </div>
        </div>

        <h3>Вопросы</h3>
        {draft.questions.map((q, qi) => (
          <fieldset key={qi} className="q-edit">
            <div className="q-head">
              <strong><span className="num">{qi + 1}</span>Вопрос</strong>
              {draft.questions.length > 1 && (
                <button type="button" className="link-btn danger" onClick={() => update((t) => { t.questions.splice(qi, 1) })}>Удалить</button>
              )}
            </div>
            <input aria-label="Текст вопроса" placeholder="Текст вопроса" value={q.text} onChange={(e) => update((t) => { t.questions[qi].text = e.target.value })} required />
            <span className="muted">Варианты ответа. Отметьте правильный.</span>
            {q.options.map((o, oi) => (
              <div key={oi} className="opt-row">
                <button
                  type="button"
                  className={`check-btn${q.correct === oi ? ' on' : ''}`}
                  aria-label="Правильный ответ"
                  aria-pressed={q.correct === oi}
                  onClick={() => update((t) => { t.questions[qi].correct = oi })}
                >
                  <Icon d={ICONS.check} size={20} />
                </button>
                <input aria-label="Вариант ответа" placeholder={`Вариант ${oi + 1}`} value={o} onChange={(e) => update((t) => { t.questions[qi].options[oi] = e.target.value })} required />
                {q.options.length > 2 && (
                  <button type="button" className="link-btn danger" aria-label="Удалить вариант" onClick={() => update((t) => {
                    const tq = t.questions[qi]
                    tq.options.splice(oi, 1)
                    if (tq.correct >= tq.options.length) tq.correct = 0
                  })}><Icon d={ICONS.close} size={16} /></button>
                )}
              </div>
            ))}
            <button type="button" className="btn dashed small" onClick={() => update((t) => { t.questions[qi].options.push('') })}>+ Вариант ответа</button>
          </fieldset>
        ))}
        <button type="button" className="btn secondary self-start" onClick={() => update((t) => { t.questions.push(emptyQuestion()) })}>+ Добавить вопрос</button>

        <label className="check">
          <input type="checkbox" checked={draft.published} onChange={(e) => update((t) => { t.published = e.target.checked })} /> Опубликовать на сайте
        </label>

        <div className="editor-foot">
          <button className="btn" type="submit">{draft.id ? 'Сохранить изменения' : 'Опубликовать тест'}</button>
          {draft.id && <button className="btn secondary" type="button" onClick={() => setDraft(emptyTest())}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
        <p className="muted">Результаты каждого теста сохраняются в профиле участника и видны в разделе «Аналитика».</p>
      </form>
    </div>
  )
}
