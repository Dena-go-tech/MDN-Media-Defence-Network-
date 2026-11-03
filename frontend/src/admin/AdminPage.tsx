import { Route, Routes } from 'react-router-dom'
import Analytics from './Analytics'
import NewsAdmin from './NewsAdmin'
import SourcesAdmin from './SourcesAdmin'
import TestsAdmin from './TestsAdmin'
import SurveyResults from './SurveyResults'
import ScriptsAdmin from './ScriptsAdmin'
import AssistantSettings from './AssistantSettings'
import { AdminResult, StudentDetail, StudentsAdmin } from './Students'

export default function AdminPage() {
  return (
    <Routes>
      <Route index element={<Analytics />} />
      <Route path="news" element={<NewsAdmin />} />
      <Route path="sources" element={<SourcesAdmin />} />
      <Route path="students" element={<StudentsAdmin />} />
      <Route path="students/:id" element={<StudentDetail />} />
      <Route path="results/:id" element={<AdminResult />} />
      <Route path="tests" element={<TestsAdmin />} />
      <Route path="surveys/:id" element={<SurveyResults />} />
      <Route path="assistant" element={<><AssistantSettings /><ScriptsAdmin /></>} />
    </Routes>
  )
}
