import { Routes, Route, Navigate } from 'react-router-dom'
import { TimetableProvider, useTimetable } from './context/TimetableContext'
import Sidebar from './components/Sidebar'
import AddClass from './components/AddClass'
import TeacherManager from './components/TeacherManager'
import SubjectManager from './components/SubjectManager'
import ClassSubjectMap from './components/ClassSubjectMap'
import BatchManager from './components/BatchManager'
import BatchOrder from './components/BatchOrder'
import TimetableGrid from './components/TimetableGrid'
import TeacherTimetable from './components/TeacherTimetable'
import Alert from './components/Alert'

function LoadingOverlay() {
  const { loading, error } = useTimetable();
  
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-lg font-bold text-red-700">Failed to load data</h2>
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg w-full break-words">{error}</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600 animate-pulse">Loading timetable data...</p>
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/timetable/class" replace />} />
          <Route path="/timetable/class" element={<TimetableGrid />} />
          <Route path="/timetable/teacher" element={<TeacherTimetable />} />
          <Route path="/subjects/add" element={<SubjectManager />} />
          <Route path="/subjects/class-map" element={<ClassSubjectMap />} />
          <Route path="/class/add" element={<AddClass />} />
          <Route path="/class/batch" element={<BatchManager />} />
          <Route path="/class/batch-order" element={<BatchOrder />} />
          <Route path="/teachers" element={<TeacherManager />} />
          <Route path="*" element={<Navigate to="/timetable/class" replace />} />
        </Routes>
      </main>
      <Alert />
      <LoadingOverlay />
    </div>
  );
}

function App() {
  return (
    <TimetableProvider>
      <AppContent />
    </TimetableProvider>
  )
}

export default App
