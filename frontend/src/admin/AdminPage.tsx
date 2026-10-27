import { NavLink, Route, Routes } from 'react-router-dom'
import NewsAdmin from './NewsAdmin'
import TestsAdmin from './TestsAdmin'

export default function AdminPage() {
  return (
    <>
      <h1>Админ-панель</h1>
      <div className="tabs">
        <NavLink to="/admin" end>Новости</NavLink>
        <NavLink to="/admin/tests">Тесты</NavLink>
      </div>
      <Routes>
        <Route index element={<NewsAdmin />} />
        <Route path="tests" element={<TestsAdmin />} />
      </Routes>
    </>
  )
}
