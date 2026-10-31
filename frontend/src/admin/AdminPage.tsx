import { NavLink, Route, Routes } from 'react-router-dom'
import NewsAdmin from './NewsAdmin'
import TestsAdmin from './TestsAdmin'
import ScriptsAdmin from './ScriptsAdmin'

export default function AdminPage() {
  return (
    <>
      <h1>Админ-панель</h1>
      <div className="tabs">
        <NavLink to="/admin" end>Новости</NavLink>
        <NavLink to="/admin/tests">Тесты</NavLink>
        <NavLink to="/admin/assistant">Ассистент</NavLink>
      </div>
      <Routes>
        <Route index element={<NewsAdmin />} />
        <Route path="tests" element={<TestsAdmin />} />
        <Route path="assistant" element={<ScriptsAdmin />} />
      </Routes>
    </>
  )
}
