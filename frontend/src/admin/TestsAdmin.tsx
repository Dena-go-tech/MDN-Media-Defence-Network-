import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, LEVELS, type Question, type Test, type TestKind, type TestSummary, type TestText } from '../api'
import { useFetch } from '../useFetch'
import { ICONS, Icon } from '../ui'
import I18nField from './LangTabs'

const emptyQuestion = (): Question => ({ text: '', options: ['', ''], correct: 0 })
const emptyKY = (): TestText => ({ title: '', description: '', questions: [] })
const emptyTest = (): Test => ({ title: '', description: '', level: LEVELS[0], kind: 'quiz', questions: [emptyQuestion()], published: true, ky: emptyKY() })

/** The translation follows the Russian structure: one entry per question, one per option. */
function alignKY(t: Test): TestText {
  const ky = t.ky ?? emptyKY()
  return {
    title: ky.title ?? '',
    description: ky.description ?? '',
    questions: t.questions.map((q, i) => ({
      text: ky.questions?.[i]?.text ?? '',
      options: q.options.map((_, j) => ky.questions?.[i]?.options?.[j] ?? ''),
    })),
  }
}

const KINDS: { id: TestKind; label: string }[] = [
  { id: 'quiz', label: 'Тест с ответами' },
  { id: 'survey', label: 'Опрос' },
]

export default function TestsAdmin() {
  const { data, reload } = useFetch<TestSummary[]>('/admin/tests')
  const [draft, setDraft] = useState<Test>(emptyTest)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const update = (fn: (t: Test) => void) =>
    setDraft((d) => {
      const copy: Test = structuredClone(d)
      copy.ky = alignKY(copy) // so fn can index translation questions/options directly
      fn(copy)
      copy.ky = alignKY(copy)
      return copy
    })

  const ky = alignKY(draft)
  const survey = draft.kind === 'survey'

  const edit = async (id: number) => {
    const t = await api<Test>(`/admin/tests/${id}`)
    setDraft({ ...t, ky: alignKY(t) })
    setError(null)
    setNotice(null)
  }

  const reset = () => setDraft(emptyTest())

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const body = { ...draft, ky: alignKY(draft) }
      if (draft.id) await api(`/admin/tests/${draft.id}`, { method: 'PUT', body })
      else await api('/admin/tests', { method: 'POST', body })
      setNotice(draft.id ? 'Изменения сохранены.' : survey ? 'Опрос создан и появился в списке.' : 'Тест создан и появился в списке.')
      reset()
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (t: TestSummary) => {
    const what = t.kind === 'survey' ? `опрос «${t.title}»? Все ответы на него тоже будут удалены.` : `тест «${t.title}»? Результаты пользователей тоже будут удалены.`
    if (!confirm(`Удалить ${what}`)) return
    await api(`/admin/tests/${t.id}`, { method: 'DELETE' })
    if (draft.id === t.id) reset()
    reload()
  }

  return (
    <div className="two-col">
      <section className="admin-list">
        <div className="list-head">
          <h1>Тесты и опросы</h1>
          <span className="pill">{data?.length ?? 0} шт.</span>
        </div>
        <button className="btn secondary block" onClick={() => { reset(); setNotice(null) }}>+ Новый тест или опрос</button>
        {data?.map((t) => (
          <div key={t.id} className={`admin-item${draft.id === t.id ? ' current' : ''}`}>
            <div className="admin-item-head">
              <strong>{t.title}</strong>
              <span className={`pill${t.published ? '' : ' pink'}`}>{t.published ? 'Опубликован' : 'Черновик'}</span>
            </div>
            <span className="muted">
              {t.kind === 'survey' ? `Опрос · ${t.responses} ответов · ` : t.level ? `${t.level} · ` : ''}{t.question_count} вопросов
            </span>
            <div className="row">
              <button className="btn dark small" onClick={() => edit(t.id)}>Редактировать</button>
              {t.kind === 'survey' && <Link to={`/admin/surveys/${t.id}`} className="btn small">Ответы</Link>}
              <Link to={`/tests/${t.id}`} className="btn ghost small">Открыть</Link>
              <button className="link-btn danger" onClick={() => remove(t)}>Удалить</button>
            </div>
          </div>
        ))}
      </section>

      <form className="editor" onSubmit={save}>
        <div className="editor-head">
          <h2>{draft.id ? (survey ? 'Редактировать опрос' : 'Редактировать тест') : 'Новый тест или опрос'}</h2>
          <span className={`pill${draft.published ? '' : ' pink'}`}>{draft.published ? 'Будет опубликован' : 'Черновик'}</span>
        </div>

        <p className="muted small">Поля с переключателем <strong>RU | KG</strong> переводятся. Пустой кыргызский перевод на сайте покажется по-русски.</p>

            <div className="field">
              <span className="field-label">Тип</span>
              <div className="seg soft" role="group" aria-label="Тип">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" className={draft.kind === k.id ? 'active' : ''} aria-pressed={draft.kind === k.id} onClick={() => update((t) => { t.kind = k.id })}>{k.label}</button>
                ))}
              </div>
              <span className="muted small">
                {survey
                  ? 'Опрос анонимный и без правильных ответов: проходить можно без регистрации, в админке видно, сколько людей выбрали каждый вариант.'
                  : 'Тест проверяет знания: у каждого вопроса есть правильный ответ, результат сохраняется в профиле и в аналитике.'}
              </span>
            </div>

            <I18nField
              id="test-title"
              label={survey ? 'Название опроса' : 'Название теста'}
              ru={draft.title}
              ky={ky.title}
              onRu={(v) => update((t) => { t.title = v })}
              onKy={(v) => update((t) => { t.ky!.title = v })}
              placeholder={survey ? 'Например: Как вы проверяете новости' : 'Например: Проверка фактов'}
              required
            />
            <I18nField
              id="test-description"
              label="Описание"
              multiline
              rows={survey ? 4 : 2}
              ru={draft.description}
              ky={ky.description}
              onRu={(v) => update((t) => { t.description = v })}
              onKy={(v) => update((t) => { t.ky!.description = v })}
              placeholder={survey ? 'Зачем опрос и что будет с ответами' : 'О чём тест и для кого'}
            />
            {!survey && (
              <div className="field">
                <span className="field-label">Уровень</span>
                <div className="seg soft" role="group" aria-label="Уровень">
                  {LEVELS.map((l) => (
                    <button key={l} type="button" className={draft.level === l ? 'active' : ''} aria-pressed={draft.level === l} onClick={() => update((t) => { t.level = l })}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            <h3>Вопросы</h3>
            {draft.questions.map((q, qi) => (
              <fieldset key={qi} className="q-edit">
                <div className="q-head">
                  <strong><span className="num">{qi + 1}</span>Вопрос</strong>
                  {draft.questions.length > 1 && (
                    <button type="button" className="link-btn danger" onClick={() => update((t) => { t.questions.splice(qi, 1); t.ky?.questions.splice(qi, 1) })}>Удалить</button>
                  )}
                </div>
                <I18nField
                  compact
                  label={`Вопрос ${qi + 1}`}
                  ru={q.text}
                  ky={ky.questions[qi]?.text ?? ''}
                  onRu={(v) => update((t) => { t.questions[qi].text = v })}
                  onKy={(v) => update((t) => { t.ky!.questions[qi].text = v })}
                  placeholder="Текст вопроса"
                  required
                />
                {survey && (
                  <div className="row wrap">
                    <label className="check"><input type="checkbox" checked={!!q.multiple} onChange={(e) => update((t) => { t.questions[qi].multiple = e.target.checked })} /> Несколько ответов</label>
                    <label className="check"><input type="checkbox" checked={!!q.optional} onChange={(e) => update((t) => { t.questions[qi].optional = e.target.checked })} /> Необязательный</label>
                  </div>
                )}
                <span className="muted">{survey ? 'Варианты ответа.' : 'Варианты ответа. Отметьте правильный.'}</span>
                {q.options.map((o, oi) => (
                  <div key={oi} className="opt-row">
                    {survey ? (
                      <span className="opt-letter" aria-hidden="true">{oi + 1}</span>
                    ) : (
                      <button
                        type="button"
                        className={`check-btn${q.correct === oi ? ' on' : ''}`}
                        aria-label="Правильный ответ"
                        aria-pressed={q.correct === oi}
                        onClick={() => update((t) => { t.questions[qi].correct = oi })}
                      >
                        <Icon d={ICONS.check} size={20} />
                      </button>
                    )}
                    <I18nField
                      compact
                      label={`Вопрос ${qi + 1}, вариант ${oi + 1}`}
                      ru={o}
                      ky={ky.questions[qi]?.options[oi] ?? ''}
                      onRu={(v) => update((t) => { t.questions[qi].options[oi] = v })}
                      onKy={(v) => update((t) => { t.ky!.questions[qi].options[oi] = v })}
                      placeholder={`Вариант ${oi + 1}`}
                      required
                    />
                    {q.options.length > 2 && (
                      <button type="button" className="link-btn danger" aria-label="Удалить вариант" onClick={() => update((t) => {
                        const tq = t.questions[qi]
                        tq.options.splice(oi, 1)
                        t.ky?.questions[qi]?.options.splice(oi, 1)
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
          <button className="btn" type="submit">{draft.id ? 'Сохранить изменения' : 'Опубликовать'}</button>
          {draft.id && <button className="btn secondary" type="button" onClick={reset}>Отмена</button>}
          {error && <span className="error" role="status">{error}</span>}
          {notice && !error && <span className="ok-text" role="status">{notice}</span>}
        </div>
        <p className="muted">
          {survey
            ? 'Ответы на опрос анонимные и видны по кнопке «Ответы» в списке слева.'
            : 'Результаты каждого теста сохраняются в профиле участника и видны в разделе «Аналитика».'}
        </p>
      </form>
    </div>
  )
}
