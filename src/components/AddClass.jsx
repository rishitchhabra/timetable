import { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function AddClass() {
  const { classes, addClass, deleteClass, showAlert } = useTimetable();
  const [newClassName, setNewClassName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    // Duplicate class name check
    if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
      showAlert('A class with this name already exists', 'error');
      return;
    }
    setSaving(true);
    try {
      await addClass(newClassName.trim());
      setNewClassName('');
      showAlert('Class created successfully', 'success');
    } catch (err) { /* already handled */ }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Add Class</h2>
      <p className="text-slate-500 mb-6">Create new classes. Use Batch management to add batches/sections to classes.</p>

      {/* Add Class Form */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">New Class</h3>
        <form onSubmit={handleAddClass} className="flex gap-3">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g., Class 10"
            className="flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={!newClassName.trim() || saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Add Class
          </button>
        </form>
      </div>

      {/* Existing Classes */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-3 bg-indigo-600 border-b">
          <h3 className="font-semibold text-white">All Classes ({classes.length})</h3>
        </div>

        {classes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No classes created yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600 w-20">S. No.</th>
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">Class Name</th>
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600 w-32">Batches</th>
                  <th className="px-5 py-3 text-right text-sm font-semibold text-slate-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {classes.map((cls, index) => (
                  <tr key={cls.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-5 py-3 text-sm text-slate-700">{index + 1}</td>
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">{cls.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{cls.sections.length} batch(es)</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${cls.name}"? This will also delete all its batches and timetable entries.`)) {
                            deleteClass(cls.id);
                          }
                        }}
                        className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete class"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
