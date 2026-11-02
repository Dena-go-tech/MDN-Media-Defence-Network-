import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { token, type Lang, type News, type Script, type TestSummary, type Verdict } from '../api'
import { useAuth } from '../auth'
import Bulb from '../Bulb'
import type { BulbController, PoseName } from '../lib/bulb-ai.js'
import { useLang, type TKey } from '../i18n'
import { useFetch } from '../useFetch'
import { Arrow, ICONS } from '../ui'

interface Message {
  role: 'user' | 'assistant'
  content: string
  verdict?: Verdict
  error?: boolean
}

const VERDICTS: Record<Exclude<Verdict, 'none'>, { label: TKey; className: string }> = {
  verified: { label: 'ai.verified', className: 'verdict ok' },
  fake: { label: 'ai.fake', className: 'verdict bad' },
  doubt: { label: 'ai.doubt', className: 'verdict warn' },
  warning: { label: 'ai.warning', className: 'verdict warn' },
}

const EXAMPLES: TKey[] = ['ai.ex1', 'ai.ex2', 'ai.ex3']

const VERDICT_RE = /\[\[VERDICT:\s*(\w+)\s*\]\]/
// Strip the verdict marker, including a half-received one at the end of a stream.
const visible = (s: string) => s.replace(/\[\[VERDICT:[^\]]*\]\]/g, '').replace(/\[\[[^\]]*$/, '').trimEnd()

const hasVoice = typeof window !== 'undefined' && 'speechSynthesis' in window

const wordsOf = (s: string) =>
  new Set(s.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-яңөү0-9]+/).filter((w) => w.length > 3))

// Pick the prepared script whose question shares the most words with the input.
function findScript(text: string, scripts: Script[]): Script | undefined {
  const input = wordsOf(text)
  let best: Script | undefined
  let bestScore = 0
  for (const s of scripts) {
    if (s.question.trim().toLowerCase() === text.trim().toLowerCase()) return s
    const q = wordsOf(s.question)
    let shared = 0
    q.forEach((w) => input.has(w) && shared++)
    const score = shared / Math.max(q.size, 1)
    if (shared >= 2 && score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return best
}

function speakAloud(text: string, lang: Lang) {
  if (!hasVoice) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  // Kyrgyz voices are rare; fall back to a Russian one, which reads Cyrillic acceptably.
  const voices = speechSynthesis.getVoices()
  const voice = (lang === 'ky' ? voices.find((v) => v.lang.startsWith('ky')) : undefined) ?? voices.find((v) => v.lang.startsWith('ru'))
  u.lang = voice?.lang ?? 'ru-RU'
  u.voice = voice ?? null
  speechSynthesis.speak(u)
}

// Site paths the AI cites for articles and tests, e.g. /news/12 or /tests/3.
const SITE_PATH = /(?<![\w/])\/(?:news|tests)\/\d+/g
type Titles = Record<string, string>

// The AI cites site materials by path; readers should see (and hear) the title instead.
const withTitles = (text: string, titles: Titles, fallback: string) =>
  text.replace(SITE_PATH, (p) => titles[p] ?? fallback)

// External URLs open in a new tab; site paths become in-app links labelled with the material's title.
function Linkified({ text, titles }: { text: string; titles: Titles }) {
  const { t } = useLang()
  const parts = text.split(/(https?:\/\/[^\s)]+|(?<![\w/])\/(?:news|tests)\/\d+)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
          : /^\/(news|tests)\/\d+$/.test(p) ? <Link key={i} to={p}>{titles[p] ?? t('ai.material')}</Link>
          : p,
      )}
    </>
  )
}

export default function AssistantPage() {
  const { user, loading } = useAuth()
  const { t, lang } = useLang()
  const status = useFetch<{ ai: boolean }>('/assistant/status')
  const scripts = useFetch<Script[]>('/assistant/scripts')
  const newsList = useFetch<News[]>('/news')
  const testList = useFetch<TestSummary[]>('/tests')
  const titles: Titles = {}
  newsList.data?.forEach((n) => { titles[`/news/${n.id}`] = n.title })
  testList.data?.forEach((t) => { titles[`/tests/${t.id}`] = `«${t.title}»` })
  const demo = status.data ? !status.data.ai : true
  const bulb = useRef<BulbController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [messages, setMessages] = useState<Message[]>([])
  // Questions typed on other pages arrive as ?q=… and land in the input box.
  const [searchParams] = useSearchParams()
  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'analyze' | 'search' | 'speak'>('idle')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [voice, setVoice] = useState(hasVoice)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    timer.current = setTimeout(() => bulb.current?.speak(t('ai.greeting'), { pace: 300 }), 400)
    return () => {
      clearTimeout(timer.current)
      if (hasVoice) speechSynthesis.cancel()
    }
    // Greets once on open, in the language the page was opened in.
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])])

  const finish = (v: Verdict) => {
    updateLast((m) => ({ ...m, verdict: v }))
    setVerdict(v)
    if (v in VERDICTS) bulb.current?.pin(v as PoseName)
    else bulb.current?.release()
    setBusy(false)
    setPhase('idle')
  }

  const start = (text: string) => {
    setMessages((ms) => [...ms.filter((m) => !m.error), { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    setVerdict(null)
    setPhase('analyze')
    bulb.current?.stop()
    bulb.current?.pin('analyze')
  }

  // Demo mode: play a prepared answer word by word, as if the AI were speaking it.
  const playScript = (text: string) => {
    const script = findScript(text, scripts.data ?? [])
    const answer = script?.answer ?? t('ai.demoFallback')
    start(text)
    timer.current = setTimeout(() => {
      setPhase('speak')
      bulb.current?.release()
      const tokens = [...answer.matchAll(/\S+/g)]
      if (voice) speakAloud(answer, lang)
      bulb.current?.speak(tokens.map((t) => t[0]), {
        pace: voice ? 330 : 260,
        onWord: (_, i) => {
          const end = tokens[i].index! + tokens[i][0].length
          updateLast((m) => ({ ...m, content: answer.slice(0, end) }))
        },
        onDone: () => finish(script?.verdict ?? 'none'),
      })
    }, 1400)
  }

  const askAI = async (text: string) => {
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: text }]
    start(text)
    let raw = ''
    let spoken = 0 // how many characters of raw text were already fed to the bulb's mouth
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.get()}` },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), lang }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const chunks = buf.split('\n\n')
        buf = chunks.pop() ?? ''
        for (const chunk of chunks) {
          if (!chunk.startsWith('data: ')) continue
          const ev = JSON.parse(chunk.slice(6))
          if (ev.type === 'search') setPhase('search')
          if (ev.type === 'error') throw new Error(ev.error)
          if (ev.type === 'text') {
            setPhase('speak')
            raw += ev.text
            // Feed complete words only, so the mouth moves in step with the text.
            const lastSpace = raw.lastIndexOf(' ')
            if (lastSpace > spoken) {
              raw.slice(spoken, lastSpace).split(/\s+/).filter(Boolean).forEach((w) => bulb.current?.feed(w))
              spoken = lastSpace
            }
            updateLast((m) => ({ ...m, content: visible(raw) }))
          }
        }
      }
      updateLast((m) => ({ ...m, content: visible(raw) }))
      if (voice) speakAloud(withTitles(visible(raw), titles, t('ai.material')), lang)
      finish((raw.match(VERDICT_RE)?.[1] ?? 'none') as Verdict)
    } catch (e) {
      updateLast(() => ({ role: 'assistant', content: (e as Error).message, error: true }))
      bulb.current?.pin('concern')
      setBusy(false)
      setPhase('idle')
    }
  }

  const send = (text: string) => {
    text = text.trim()
    if (!text || busy) return
    if (demo) playScript(text)
    else askAI(text)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const reset = () => {
    clearTimeout(timer.current)
    if (hasVoice) speechSynthesis.cancel()
    setMessages([])
    setVerdict(null)
    setBusy(false)
    setPhase('idle')
    bulb.current?.release()
    bulb.current?.speak(t('ai.restart'), { pace: 300 })
  }

  const toggleVoice = () => {
    if (voice && hasVoice) speechSynthesis.cancel()
    setVoice(!voice)
  }

  const statusText = {
    analyze: t('ai.analyze'),
    search: t('ai.search'),
    speak: t('ai.speak'),
    idle: verdict && verdict in VERDICTS ? t(VERDICTS[verdict as keyof typeof VERDICTS].label) : t('ai.ready'),
  }[phase]

  const examples = demo ? (scripts.data ?? []).map((s) => s.question) : EXAMPLES.map((k) => t(k))
  // Demo answers are prepared in advance, so they are open to everyone; the live AI needs an account.
  const canAsk = demo || !!user

  return (
    <div className="assistant">
      <aside className="assistant-stage">
        <Bulb ref={bulb} expressions="some" />
        <div className="assistant-status" aria-live="polite">
          <span className="muted">BulbAI</span>
          <strong>{statusText}</strong>
        </div>
        {hasVoice && (
          <button className="btn secondary voice-toggle" onClick={toggleVoice} aria-pressed={voice}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS.speaker} /><path d={voice ? ICONS.waveOn : ICONS.waveOff} />
            </svg>
            {voice ? t('ai.voiceOn') : t('ai.voiceOff')}
          </button>
        )}
      </aside>

      <section className="assistant-chat">
        <div className="chat-head">
          <div>
            <h1>{t('ai.title')} {demo && <span className="badge demo">{t('ai.demo')}</span>}</h1>
            <p className="muted">{demo ? t('ai.demoText') : t('ai.liveText')}</p>
          </div>
          {messages.length > 0 && <button className="btn secondary" onClick={reset}>{t('ai.newChat')}</button>}
        </div>

        <div className="chat-list" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>
              {m.verdict && m.verdict in VERDICTS && (
                <span className={VERDICTS[m.verdict as keyof typeof VERDICTS].className}>
                  {t(VERDICTS[m.verdict as keyof typeof VERDICTS].label)}
                </span>
              )}
              {m.content
                ? m.content.split('\n').map((line, j) => (line ? <p key={j}><Linkified text={line} titles={titles} /></p> : null))
                : <p className="muted">{phase === 'search' ? t('ai.search') : t('ai.thinking')}</p>}
            </div>
          ))}
          {!busy && examples.length > 0 && (
            <div className="chat-empty">
              <p className="label">{messages.length ? t('ai.more') : t('ai.try')}</p>
              {examples.map((ex) => (
                <button key={ex} className="example" disabled={!canAsk} onClick={() => send(ex)}>
                  <span>{ex}</span><span className="example-arrow"><Arrow /></span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? null : canAsk ? (
          <form className="chat-input" onSubmit={onSubmit}>
            <textarea
              rows={2}
              placeholder={t('ai.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !input.trim()}>{t('ai.check')}</button>
          </form>
        ) : (
          <div className="result">
            <span>{t('ai.loginBefore')}<Link to="/login" className="link">{t('ai.loginLink')}</Link>{t('ai.loginAfter')}</span>
          </div>
        )}
      </section>
    </div>
  )
}
