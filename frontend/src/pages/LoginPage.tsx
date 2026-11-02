import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLang } from '../i18n'

export default function LoginPage() {
  const { user, login, register } = useAuth()
  const { t } = useLang()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/profile" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, name, password)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>{mode === 'login' ? t('login.title') : t('login.register')}</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {mode === 'register' && (
        <input placeholder={t('login.name')} value={name} onChange={(e) => setName(e.target.value)} required />
      )}
      <input type="password" placeholder={t('login.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit">{mode === 'login' ? t('login.submit') : t('login.submitRegister')}</button>
      <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? t('login.toRegister') : t('login.toLogin')}
      </button>
    </form>
  )
}
