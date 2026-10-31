import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import LogoBulb from './LogoBulb'
import NewsPage from './pages/NewsPage'
import NewsDetail from './pages/NewsDetail'
import TestsPage from './pages/TestsPage'
import TestRun from './pages/TestRun'
import ProfilePage from './pages/ProfilePage'
import AssistantPage from './pages/AssistantPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './admin/AdminPage'
import './styles.css'

const ICONS = {
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2V5Zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  tests: 'M9 5h10M9 12h10M9 19h10M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2',
  assistant: 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Zm-2.5 17h5',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  admin: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Header() {
  const { user } = useAuth()
  return (
    <header className="header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">
          <LogoBulb />
          <span className="logo-mark">MDN</span>
          <span className="logo-text">Media Defence Network KG</span>
        </NavLink>
        {/* On phones this becomes a fixed bottom tab bar (see .nav in styles.css). */}
        <nav className="nav">
          <NavLink to="/" end><Icon d={ICONS.news} />Новости</NavLink>
          <NavLink to="/tests"><Icon d={ICONS.tests} />Тесты</NavLink>
          <NavLink to="/assistant"><Icon d={ICONS.assistant} />Ассистент</NavLink>
          <NavLink to="/profile"><Icon d={ICONS.profile} />{user ? 'Профиль' : 'Войти'}</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin"><Icon d={ICONS.admin} />Админка</NavLink>}
        </nav>
      </div>
    </header>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.role !== 'admin') return <Navigate to="/profile" replace />
  return <>{children}</>
}

function App() {
  return (
    <>
      <Header />
      <main className="container main">
        <Routes>
          <Route path="/" element={<NewsPage />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/:id" element={<TestRun />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} Media Defence Network of Kyrgyzstan</div>
      </footer>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
