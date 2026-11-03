export interface User {
  id: number
  email: string
  name: string
  role: 'user' | 'admin'
  created_at: string
}

export interface News {
  id: number
  title: string
  summary: string
  body: string
  image_url: string
  category: string
  featured: boolean
  published: boolean
  created_at: string
  ky?: NewsText
  /** Filled in on news imported from a channel's feed. */
  source_id: number | null
  source_name: string
  source_url: string
}

export interface RatingRow {
  id: number
  rank: number
  name: string
  url: string
  is_state: boolean
  votes: number
  activity: number
  posts_7d: number
  last_post_at: string | null
  availability: number
  status: 'ok' | 'error' | 'blocked' | 'pending'
}

export interface Rating {
  updated_at: string | null
  total_votes: number
  my_vote: number | null
  rows: RatingRow[]
}

export interface Source {
  id: number
  name: string
  url: string
  feed_url: string
  is_state: boolean
  import_news: boolean
  category: string
  enabled: boolean
  last_status: string
  last_error: string
  last_fetch_at: string | null
  fetch_ok: number
  fetch_total: number
  posts_7d: number
}

export interface NewsText {
  title: string
  summary: string
  body: string
}

export type TestKind = 'quiz' | 'survey'

export interface Question {
  text: string
  options: string[]
  correct: number
  multiple?: boolean
  optional?: boolean
}

export interface TestText {
  title: string
  description: string
  questions: { text: string; options: string[] }[]
}

export interface TestSummary {
  id: number
  title: string
  description: string
  level: string
  kind: TestKind
  question_count: number
  published: boolean
  created_at: string
  responses: number
}

export interface PublicTest {
  id: number
  title: string
  description: string
  level: string
  kind: TestKind
  questions: { text: string; options: string[]; multiple?: boolean; optional?: boolean }[]
}

export interface Test {
  id?: number
  title: string
  description: string
  level: string
  kind: TestKind
  questions: Question[]
  published: boolean
  ky?: TestText
}

export interface SurveyStats {
  id: number
  title: string
  title_ky: string
  published: boolean
  responses: number
  by_lang: { ru: number; ky: number }
  by_source: { site: number; import: number }
  last_at: string | null
  questions: { text: string; text_ky: string; options: string[]; multiple: boolean; optional: boolean; counts: number[]; answered: number }[]
}

export interface Result {
  id: number
  test_id: number
  test_title: string
  score: number
  total: number
  created_at: string
}

export type Verdict = 'verified' | 'fake' | 'doubt' | 'warning' | 'none'

export interface Script {
  id: number
  question: string
  answer: string
  verdict: Verdict
  position: number
  published: boolean
  created_at: string
}

export interface SubmitResult {
  score: number
  total: number
  correct: number[]
}

export interface Stats {
  attempts: number
  avg_pct: number
  users: number
  published_tests: number
  tests: { id: number; title: string; attempts: number; avg_pct: number }[]
  recent: { id: number; user_id: number; created_at: string; user_name: string; test_title: string; score: number; total: number }[]
  hard_questions: { test_id: number; test_title: string; question: string; answers: number; wrong: number; wrong_pct: number }[]
}

/** One question as it was when the test was taken; chosen is -1 if unanswered. */
export interface AnswerDetail {
  text: string
  options: string[]
  chosen: number
  correct: number
}

export interface ResultDetail {
  id: number
  test_id: number
  test_title: string
  user_id: number
  user_name: string
  user_email: string
  score: number
  total: number
  created_at: string
  details: AnswerDetail[]
}

export interface Student {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
  created_at: string
  attempts: number
  avg_pct: number
  last_at: string | null
}

export const pct = (score: number, total: number) => (total ? Math.round((score / total) * 100) : 0)

/** Uploads an image through the admin API and returns its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.get() ?? ''}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.url as string
}

export const CATEGORIES = ['Право', 'Безопасность', 'Этика', 'Проверка фактов']
export const STATE_CATEGORY = 'Госисточники'
export const MEDIA_CATEGORY = 'СМИ'
export const LEVELS = ['Базовый', 'Средний', 'Продвинутый']

// Tag backgrounds per category (text on them is always dark ink); unknown ones get a neutral sand.
const CATEGORY_COLORS: Record<string, string> = {
  'Право': '#e58aa7',
  'Безопасность': '#d6def6',
  'Этика': '#f2c64b',
  'Проверка фактов': '#bfe3cf',
  [STATE_CATEGORY]: '#e8e3d5',
}
export const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? '#e8e3d5'

export const readMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 180))

export type Lang = 'ru' | 'ky'
const LANG_KEY = 'mdn_lang'

/** Portal language (shown as RU / KG). Kept outside React so api() can read it. */
export const langStore = {
  get: (): Lang => {
    try {
      return localStorage.getItem(LANG_KEY) === 'ky' ? 'ky' : 'ru'
    } catch {
      return 'ru'
    }
  },
  set: (l: Lang) => {
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch { /* private mode: the choice just isn't remembered */ }
  },
}

// Browsers often ship without Kyrgyz locale data (dates come out in English), so Kyrgyz dates are formatted by hand.
const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
// The admin panel stays in Russian whatever the portal language is.
const isKY = () => langStore.get() === 'ky' && !window.location.pathname.startsWith('/admin')
const pad = (n: number) => String(n).padStart(2, '0')

const TOKEN_KEY = 'mdn_token'

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  // Public content comes back translated when the portal is in Kyrgyz.
  if ((init.method ?? 'GET') === 'GET' && langStore.get() === 'ky' && !path.startsWith('/admin')) {
    path += (path.includes('?') ? '&' : '?') + 'lang=ky'
  }
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export const formatDate = (s: string) => {
  const d = new Date(s)
  return isKY()
    ? `${d.getFullYear()}-ж. ${d.getDate()}-${KY_MONTHS[d.getMonth()]}`
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export const formatShortDate = (s: string) => {
  const d = new Date(s)
  // Without the year, an old article in the feed would look recent.
  if (d.getFullYear() !== new Date().getFullYear()) return formatDate(s)
  return isKY() ? `${d.getDate()}-${KY_MONTHS[d.getMonth()]}` : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export const formatTime = (s: string) => {
  const d = new Date(s)
  if (isKY()) return `${d.getDate()}-${KY_MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
