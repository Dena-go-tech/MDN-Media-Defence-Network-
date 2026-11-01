import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useFetch } from '../useFetch'

interface Settings {
  system_prompt: string
  site_context: boolean
  web_search: boolean
  updated_at: string
}

interface SettingsResponse {
  settings: Settings
  default_prompt: string
  verdict_format: string
  model: string
  ai_enabled: boolean
  context: { news: number; tests: number; chars: number }
}

export default function AssistantSettings() {
  const { data, error: loadError, reload } = useFetch<SettingsResponse>('/admin/assistant/settings')
  const [draft, setDraft] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setDraft(data.settings) }, [data])

  if (loadError) return <p className="error">{loadError}</p>
  if (!data || !draft) return <p className="muted">Загрузка настроек…</p>

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setDraft({ ...draft, [k]: v }); setNotice(null) }
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/admin/assistant/settings', { method: 'PUT', body: draft })
      setNotice('Сохранено. Новые ответы ассистента уже используют эти настройки.')
      setError(null)
      reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <div className="editor-head">
        <h2>Настройки ИИ</h2>
        <span className={`pill${data.ai_enabled ? '' : ' pink'}`}>
          {data.ai_enabled ? `ИИ включён · ${data.model}` : 'ИИ выключен: нет ANTHROPIC_API_KEY'}
        </span>
      </div>

      <label>Системный промпт: роль, тон и правила ответа
        <textarea rows={14} value={draft.system_prompt} onChange={(e) => set('system_prompt', e.target.value)} required />
      </label>
      <div className="row wrap">
        <button type="button" className="btn secondary small" disabled={draft.system_prompt === data.default_prompt}
          onClick={() => set('system_prompt', data.default_prompt)}>Вернуть стандартный промпт</button>
      </div>

      <details className="muted">
        <summary>Что добавляется к промпту автоматически</summary>
        <p className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{data.verdict_format}</p>
      </details>

      <label className="check">
        <input type="checkbox" checked={draft.site_context} onChange={(e) => set('site_context', e.target.checked)} />
        Давать ИИ материалы сайта: опубликованные новости и тесты
      </label>
      <p className="muted small">
        Сейчас в контекст попадает {data.context.news} новостей и {data.context.tests} тестов
        (≈{Math.round(data.context.chars / 1000)} тыс. символов). Контекст собирается заново при каждом вопросе,
        поэтому новые публикации ИИ видит сразу.
      </p>
      <label className="check">
        <input type="checkbox" checked={draft.web_search} onChange={(e) => set('web_search', e.target.checked)} />
        Разрешить веб-поиск для проверки новостей
      </label>

      <div className="editor-foot">
        <button className="btn" type="submit" disabled={!dirty || saving}>{saving ? 'Сохраняем…' : 'Сохранить настройки'}</button>
        {dirty && <button className="btn secondary" type="button" onClick={() => setDraft(data.settings)}>Отменить изменения</button>}
        {error && <span className="error" role="status">{error}</span>}
        {notice && !error && <span className="ok-text" role="status">{notice}</span>}
      </div>
    </form>
  )
}
