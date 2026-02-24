import { useState, useRef, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';

/* Multi-select checkbox dropdown (matching reference design) */
function MultiSelectDropdown({ items, selectedIds, onChange, placeholder = 'None selected' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : items.map(i => i.id));
  };

  const toggleItem = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const label = selectedIds.length === 0
    ? placeholder
    : selectedIds.length === items.length
      ? 'All selected'
      : `${selectedIds.length} selected`;

  return (
    <div ref={ref} className="relative inline-block w-52">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 hover:border-slate-400 transition-colors"
      >
        <span className={selectedIds.length === 0 ? 'text-slate-400' : ''}>{label}</span>
        <span className="text-slate-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">All</span>
          </label>
          {items.map(item => (
            <label
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors ${
                selectedIds.includes(item.id) ? 'bg-indigo-50/50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">{item.name}</span>
            </label>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">No classes available</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubjectManager() {
  const { subjects, classes, addSubject, deleteSubject, showAlert } = useTimetable();
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const sortedClasses = [...classes].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.name.match(/\d+/)?.[0] || 0);
    return numA - numB;
  });

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      showAlert('Please enter subject name', 'warning');
      return;
    }
    if (subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
      showAlert('Subject already exists', 'error');
      return;
    }
    setSaving(true);
    try {
      await addSubject(newSubjectName.trim(), selectedClassIds);
      setNewSubjectName('');
      setSelectedClassIds([]);
      showAlert('Subject added successfully', 'success');
    } catch (err) { /* handled */ }
    setSaving(false);
  };

  const handleDelete = (subject) => {
    if (window.confirm(`Delete "${subject.name}"? This will remove it from all classes and batches.`)) {
      deleteSubject(subject.id);
      showAlert('Subject deleted', 'info');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* New Subject Entry */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-1">New Subject Entry</h2>
        <div className="h-1 bg-indigo-500 rounded mb-4" />

        <div className="bg-slate-50 rounded-lg border p-5">
          <form onSubmit={handleAddSubject} className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <label className="font-semibold text-slate-700 whitespace-nowrap">Subject Name :</label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="New subject-name here"
                className="w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Add
              </button>
            </div>

            {/* Class Selection — Multi-select dropdown */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm font-medium text-slate-600">For Classes:</span>
              <MultiSelectDropdown
                items={sortedClasses}
                selectedIds={selectedClassIds}
                onChange={setSelectedClassIds}
                placeholder="None selected"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Subject List */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Subject List</h2>
        <div className="h-1 bg-indigo-500 rounded mb-4" />

        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 w-16">S.N.</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Subject</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Classes</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, index) => {
                const assignedClasses = (subject.classIds || [])
                  .map(cid => classes.find(c => c.id === cid)?.name)
                  .filter(Boolean);

                return (
                  <tr key={subject.id} className={`border-b last:border-b-0 ${index % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-slate-100 transition-colors`}>
                    <td className="py-3 px-4 text-sm text-slate-600">{index + 1}.</td>
                    <td className="py-3 px-4 text-sm text-slate-800 font-medium">{subject.name}</td>
                    <td className="py-3 px-4 text-sm">
                      {assignedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedClasses.map((name, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">No classes assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(subject)}
                        className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                        title="Delete subject"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No subjects added yet. Use the form above to add your first subject.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
