import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import NewsPage from './pages/NewsPage'
import NewsDetail from './pages/NewsDetail'
import TestsPage from './pages/TestsPage'
import TestRun from './pages/TestRun'
import ProfilePage from './pages/ProfilePage'
import LoginPage from './pages/LoginPage'
import AdminPage from './admin/AdminPage'
import './styles.css'

function Header() {
  const { user } = useAuth()
  return (
    <header className="header">
      <div className="container header-inner">
        <NavLink to="/" className="logo">
          <span className="logo-mark">MDN</span>
          <span className="logo-text">Media Defence Network KG</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>Новости</NavLink>
          <NavLink to="/tests">Тесты</NavLink>
          <NavLink to="/profile">{user ? 'Профиль' : 'Войти'}</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Админка</NavLink>}
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
