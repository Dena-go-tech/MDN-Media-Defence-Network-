import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { LangProvider, LangSwitch, useLang } from './i18n'
import { ICONS, Icon, LogoMark } from './ui'
import NewsPage from './pages/NewsPage'
import NewsDetail from './pages/NewsDetail'
import TestsPage from './pages/TestsPage'
import TestRun from './pages/TestRun'
import ProfilePage, { MyResult } from './pages/ProfilePage'
import AssistantPage from './pages/AssistantPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './admin/AdminPage'
import './styles.css'

function Logo({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <Link to="/" className="logo">
      <LogoMark />
      <span className="logo-text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </Link>
  )
}

function Header() {
  const { user } = useAuth()
  const { t } = useLang()
  const { pathname } = useLocation()
  const inTest = /^\/tests\/\d+/.test(pathname)
  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          <Logo title="Media Defence Network" subtitle="Кыргызстан" />
          {inTest ? (
            <div className="header-tools">
              <LangSwitch />
              <Link to="/tests" className="btn ghost exit-btn" aria-label={t('header.exitTest')}><Icon d={ICONS.close} size={16} /><span>{t('header.exitTest')}</span></Link>
            </div>
          ) : (
            <>
              {/* On phones this becomes a fixed bottom tab bar (see .nav in styles.css). */}
              <nav className="nav" aria-label={t('nav.main')}>
                <NavLink to="/" end><Icon d={ICONS.news} className="nav-icon" size={24} />{t('nav.news')}</NavLink>
                <NavLink to="/tests"><Icon d={ICONS.tests} className="nav-icon" size={24} />{t('nav.tests')}</NavLink>
                <NavLink to="/assistant"><Icon d={ICONS.assistant} className="nav-icon" size={24} />{t('nav.assistant')}</NavLink>
                <NavLink to="/profile"><Icon d={ICONS.profile} className="nav-icon" size={24} />{user ? t('nav.profile') : t('nav.login')}</NavLink>
                {user?.role === 'admin' && <NavLink to="/admin"><Icon d={ICONS.admin} className="nav-icon" size={24} />{t('nav.admin')}</NavLink>}
              </nav>
              <div className="header-tools">
                <LangSwitch />
                <Link to="/tests" className="btn header-cta">{t('header.cta')}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function AdminHeader() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          <Logo title="Media Defence Network" subtitle={<span className="admin-tag">Админка</span>} />
          <nav className="admin-nav" aria-label="Разделы админки">
            <NavLink to="/admin" end>Аналитика</NavLink>
            <NavLink to="/admin/students">Студенты</NavLink>
            <NavLink to="/admin/news">Новости</NavLink>
            <NavLink to="/admin/tests">Тесты и опросы</NavLink>
            <NavLink to="/admin/assistant">Ассистент</NavLink>
          </nav>
          <Link to="/" className="btn secondary">На портал</Link>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const { t } = useLang()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span><strong>Media Defence Network KG</strong> · © {new Date().getFullYear()}</span>
        <nav aria-label={t('footer.links')}>
          <Link to="/">{t('nav.news')}</Link>
          <Link to="/tests">{t('nav.tests')}</Link>
          <Link to="/assistant">{t('footer.assistant')}</Link>
          <Link to="/profile">{t('nav.profile')}</Link>
        </nav>
      </div>
    </footer>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.role !== 'admin') return <Navigate to="/profile" replace />
  return <>{children}</>
}

function App() {
  const isAdmin = useLocation().pathname.startsWith('/admin')
  return (
    <>
      {isAdmin ? <AdminHeader /> : <Header />}
      <main className="container main">
        <Routes>
          <Route path="/" element={<NewsPage />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/:id" element={<TestRun />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/results/:id" element={<MyResult />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
