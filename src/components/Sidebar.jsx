import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTimetable } from '../context/TimetableContext';

export default function Sidebar() {
  const { classes, teachers, hasPendingChanges } = useTimetable();
  const location = useLocation();
  const path = location.pathname;

  const [expandedClasses, setExpandedClasses] = useState({});
  const [expandedTimetable, setExpandedTimetable] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState(false);
  const [expandedClassMenu, setExpandedClassMenu] = useState(false);

  const toggleClass = (classId) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));
  };

  const isActive = (...paths) => paths.some(p => path === p || path.startsWith(p + '/'));

  return (
    <aside className="w-64 bg-slate-800 text-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <Link to="/timetable/class" className="text-xl font-bold flex items-center gap-2 hover:text-indigo-300 transition-colors">
          📅 Timetable Maker
        </Link>
      </div>

      {/* Navigation Tabs */}
      <nav className="p-2">
        {/* Timetable Dropdown */}
        <div className="mb-1">
          <button
            onClick={() => setExpandedTimetable(!expandedTimetable)}
            className={`w-full text-left px-4 py-2 rounded-lg flex items-center justify-between transition-colors ${
              isActive('/timetable')
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-700 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📅</span>
              <span>Timetable</span>
            </span>
            <span className="text-xs">{expandedTimetable ? '▼' : '▶'}</span>
          </button>
          
          {expandedTimetable && (
            <div className="ml-4 mt-1 space-y-1">
              <Link
                to="/timetable/class"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/timetable/class'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                📋 Class Timetable
              </Link>
              <Link
                to="/timetable/teacher"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/timetable/teacher'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                👤 Teacher Timetable
              </Link>
            </div>
          )}
        </div>

        {/* Subjects Dropdown */}
        <div className="mb-1">
          <button
            onClick={() => setExpandedSubjects(!expandedSubjects)}
            className={`w-full text-left px-4 py-2 rounded-lg flex items-center justify-between transition-colors ${
              isActive('/subjects')
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-700 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📚</span>
              <span>Subjects</span>
            </span>
            <span className="text-xs">{expandedSubjects ? '▼' : '▶'}</span>
          </button>
          
          {expandedSubjects && (
            <div className="ml-4 mt-1 space-y-1">
              <Link
                to="/subjects/add"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/subjects/add'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                ➕ Add Subject
              </Link>
              <Link
                to="/subjects/class-map"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/subjects/class-map'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                🗺️ Class Subject Map
              </Link>
            </div>
          )}
        </div>

        {/* Class Dropdown */}
        <div className="mb-1">
          <button
            onClick={() => setExpandedClassMenu(!expandedClassMenu)}
            className={`w-full text-left px-4 py-2 rounded-lg flex items-center justify-between transition-colors ${
              isActive('/class')
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-700 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🏫</span>
              <span>Class</span>
            </span>
            <span className="text-xs">{expandedClassMenu ? '▼' : '▶'}</span>
          </button>
          
          {expandedClassMenu && (
            <div className="ml-4 mt-1 space-y-1">
              <Link
                to="/class/add"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/class/add'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                ➕ Add Class
              </Link>
              <Link
                to="/class/batch"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/class/batch'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                ➕ Add Batch
              </Link>
              <Link
                to="/class/batch-order"
                className={`w-full block text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  path === '/class/batch-order'
                    ? 'bg-indigo-500 text-white' 
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                🔢 Batch Order
              </Link>
            </div>
          )}
        </div>

        {/* Teachers Tab */}
        <Link
          to="/teachers"
          className={`w-full block text-left px-4 py-2 rounded-lg mb-1 flex items-center gap-2 transition-colors ${
            path === '/teachers' 
              ? 'bg-indigo-600 text-white' 
              : 'hover:bg-slate-700 text-slate-300'
          }`}
        >
          <span>👨‍🏫</span>
          <span>Teachers</span>
        </Link>
      </nav>

      {/* Pending Changes Indicator */}
      {hasPendingChanges && (
        <div className="mx-2 px-3 py-2 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-200 text-sm">
          ⚠️ Unsaved changes
        </div>
      )}

      {/* Quick Access - Classes */}
      <div className="flex-1 overflow-y-auto p-2 border-t border-slate-700 mt-2">
        <h3 className="text-xs uppercase text-slate-500 font-semibold px-2 mb-2">Quick Access</h3>
        
        {/* Classes Tree */}
        <div className="space-y-1">
          {classes.map(cls => (
            <div key={cls.id}>
              <button
                onClick={() => toggleClass(cls.id)}
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-700 flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span>{expandedClasses[cls.id] ? '📂' : '📁'}</span>
                  <span>{cls.name}</span>
                </span>
                <span className="text-xs text-slate-500">{cls.sections.length}</span>
              </button>
              
              {expandedClasses[cls.id] && (
                <div className="ml-4 space-y-1">
                  {cls.sections.map(section => (
                    <Link
                      key={section.id}
                      to={`/timetable/class?class=${cls.id}&section=${section.id}`}
                      className="w-full block text-left px-3 py-1.5 rounded text-sm hover:bg-slate-700"
                    >
                      📄 Section {section.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Teachers Quick List */}
        <h3 className="text-xs uppercase text-slate-500 font-semibold px-2 mb-2 mt-4">Teachers</h3>
        <div className="space-y-1">
          {teachers.slice(0, 5).map(teacher => (
            <Link
              key={teacher.id}
              to={`/timetable/teacher?teacher=${teacher.id}`}
              className="w-full block text-left px-3 py-1.5 rounded text-sm hover:bg-slate-700"
            >
              👤 {teacher.name}
            </Link>
          ))}
          {teachers.length > 5 && (
            <Link
              to="/teachers"
              className="w-full block text-left px-3 py-1.5 rounded text-sm text-slate-400 hover:bg-slate-700"
            >
              + {teachers.length - 5} more...
            </Link>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        School Timetable Manager v1.0
      </div>
    </aside>
  );
}
