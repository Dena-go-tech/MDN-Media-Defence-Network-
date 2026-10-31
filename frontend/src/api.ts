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
  featured: boolean
  published: boolean
  created_at: string
}

export interface Question {
  text: string
  options: string[]
  correct: number
}

export interface TestSummary {
  id: number
  title: string
  description: string
  question_count: number
  published: boolean
  created_at: string
}

export interface PublicTest {
  id: number
  title: string
  description: string
  questions: { text: string; options: string[] }[]
}

export interface Test {
  id?: number
  title: string
  description: string
  questions: Question[]
  published: boolean
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

export const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
