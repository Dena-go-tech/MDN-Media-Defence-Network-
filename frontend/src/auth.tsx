import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, token, type User } from './api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token.get()) {
      setLoading(false)
      return
    }
    api<User>('/me')
      .then(setUser)
      .catch(() => token.clear())
      .finally(() => setLoading(false))
  }, [])

  const handleAuth = (res: { token: string; user: User }) => {
    token.set(res.token)
    setUser(res.user)
  }

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) =>
      handleAuth(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (email, name, password) =>
      handleAuth(await api('/auth/register', { method: 'POST', body: { email, name, password } })),
    logout: () => {
      token.clear()
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
