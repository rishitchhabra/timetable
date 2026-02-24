import { useState, useRef, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';

function Spinner({ size = 'sm' }) {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ──────────────── Subject Search Dropdown ──────────────── */
function SubjectSearchDropdown({ subjects, selectedId, onSelect, placeholder = 'Search subjects...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = subjects.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  const selected = subjects.find(s => s.id === selectedId);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-slate-300 rounded-lg bg-white cursor-pointer" onClick={() => setOpen(!open)}>
        <input
          type="text"
          value={open ? query : (selected?.name || '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 outline-none rounded-lg text-sm"
        />
        <span className="px-3 text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">No subjects found</div>
          ) : filtered.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id); setQuery(''); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors ${
                s.id === selectedId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────── Map Subjects Modal ──────────────── */
function MapSubjectsModal({ teacher, onClose }) {
  const {
    subjects, classes, teacherSubjectMap,
    addTeacherSubjectMapping, removeTeacherSubjectMapping
  } = useTimetable();

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [busyKey, setBusyKey] = useState(null); // "classId" or "classId-sectionId"

  const sortedClasses = [...classes].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.name.match(/\d+/)?.[0] || 0);
    return numA - numB;
  });

  // helpers
  const teacherMappings = teacherSubjectMap.filter(m => m.teacherId === teacher.id);

  const getSubjectClasses = (subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject?.classIds) return [];
    return sortedClasses.filter(cls => subject.classIds.includes(cls.id));
  };

  // Check whether a class-level (all batches) mapping exists
  const hasClassMapping = (subjectId, classId) =>
    teacherSubjectMap.some(m => m.teacherId === teacher.id && m.subjectId === subjectId && m.classId === classId && !m.sectionId);

  // Check whether a specific batch mapping exists
  const hasSectionMapping = (subjectId, classId, sectionId) =>
    teacherSubjectMap.some(m => m.teacherId === teacher.id && m.subjectId === subjectId && m.classId === classId && m.sectionId === sectionId);

  // Toggle class-level mapping (all batches)
  const toggleClassMapping = async (subjectId, classId) => {
    const key = classId;
    setBusyKey(key);
    try {
      if (hasClassMapping(subjectId, classId)) {
        await removeTeacherSubjectMapping(teacher.id, subjectId, classId, null);
      } else {
        // Remove any individual batch mappings first, then add class-level
        const batchMappings = teacherSubjectMap.filter(
          m => m.teacherId === teacher.id && m.subjectId === subjectId && m.classId === classId && m.sectionId
        );
        for (const bm of batchMappings) {
          await removeTeacherSubjectMapping(teacher.id, subjectId, classId, bm.sectionId);
        }
        await addTeacherSubjectMapping(teacher.id, subjectId, classId, null);
      }
    } catch { /* handled by context */ }
    setBusyKey(null);
  };

  // Toggle individual batch mapping
  const toggleSectionMapping = async (subjectId, classId, sectionId) => {
    const key = `${classId}-${sectionId}`;
    setBusyKey(key);
    try {
      if (hasSectionMapping(subjectId, classId, sectionId)) {
        await removeTeacherSubjectMapping(teacher.id, subjectId, classId, sectionId);
      } else {
        // If "All batches" is on, remove it first
        if (hasClassMapping(subjectId, classId)) {
          await removeTeacherSubjectMapping(teacher.id, subjectId, classId, null);
        }
        await addTeacherSubjectMapping(teacher.id, subjectId, classId, sectionId);
      }
    } catch { /* handled by context */ }
    setBusyKey(null);
  };

  // Build summary of current mappings for the selected subject
  const subjectMappings = selectedSubjectId
    ? teacherMappings.filter(m => m.subjectId === selectedSubjectId)
    : [];

  // Build summary grouped by subject
  const groupedMappings = {};
  for (const m of teacherMappings) {
    if (!groupedMappings[m.subjectId]) groupedMappings[m.subjectId] = [];
    groupedMappings[m.subjectId].push(m);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-lg">👨‍🏫</div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{teacher.name}</h2>
              <p className="text-xs text-slate-500">{teacher.teacherCode ? `ID: ${teacher.teacherCode}` : ''} · {teacherMappings.length} mapping{teacherMappings.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white border hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors text-lg">✕</button>
        </div>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Select subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">1. Select a Subject</label>
            <div className="max-w-sm">
              <SubjectSearchDropdown
                subjects={subjects}
                selectedId={selectedSubjectId}
                onSelect={(id) => setSelectedSubjectId(id === selectedSubjectId ? '' : id)}
                placeholder="Type to search subjects…"
              />
            </div>
            {subjects.length === 0 && <p className="text-sm text-slate-400 mt-2">No subjects added yet.</p>}
          </div>

          {/* Step 2: Select classes / batches */}
          {selectedSubjectId && (() => {
            const availableClasses = getSubjectClasses(selectedSubjectId);
            if (availableClasses.length === 0) {
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                  This subject is not assigned to any class yet. Assign it via <span className="font-medium">Class Subject Map</span> first.
                </div>
              );
            }
            return (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">2. Select Classes / Batches</label>
                <div className="space-y-3">
                  {availableClasses.map(cls => {
                    const sections = cls.sections || [];
                    const classMapped = hasClassMapping(selectedSubjectId, cls.id);

                    return (
                      <div key={cls.id} className="bg-slate-50 rounded-xl border p-4">
                        {/* Class row — "All Batches" toggle */}
                        <label className={`flex items-center gap-3 cursor-pointer ${busyKey === cls.id ? 'opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            checked={classMapped}
                            onChange={() => toggleClassMapping(selectedSubjectId, cls.id)}
                            disabled={!!busyKey}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <span className="font-semibold text-slate-800">{cls.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium">All Batches</span>
                          {busyKey === cls.id && <Spinner />}
                        </label>

                        {/* Individual batches */}
                        {sections.length > 0 && !classMapped && (
                          <div className="mt-3 ml-8 flex flex-wrap gap-2">
                            {sections.map(sec => {
                              const secKey = `${cls.id}-${sec.id}`;
                              const mapped = hasSectionMapping(selectedSubjectId, cls.id, sec.id);
                              return (
                                <label
                                  key={sec.id}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                                    mapped
                                      ? 'bg-green-50 border-green-300 text-green-700'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                  } ${busyKey === secKey ? 'opacity-60' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={mapped}
                                    onChange={() => toggleSectionMapping(selectedSubjectId, cls.id, sec.id)}
                                    disabled={!!busyKey}
                                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                  />
                                  {sec.name}
                                  {busyKey === secKey && <Spinner />}
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {sections.length > 0 && classMapped && (
                          <p className="mt-2 ml-8 text-xs text-slate-400">All {sections.length} batch{sections.length !== 1 ? 'es' : ''} included</p>
                        )}
                        {sections.length === 0 && (
                          <p className="mt-2 ml-8 text-xs text-slate-400">No batches created for this class</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Current mappings summary */}
          {teacherMappings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">All Mappings Summary</h3>
              <div className="bg-slate-50 rounded-xl border p-4 space-y-2">
                {Object.entries(groupedMappings).map(([subjectId, maps]) => {
                  const subject = subjects.find(s => s.id === subjectId);
                  return (
                    <div key={subjectId} className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-slate-700 whitespace-nowrap">{subject?.name || 'Unknown'}</span>
                      <span className="text-slate-300">→</span>
                      <div className="flex flex-wrap gap-1">
                        {maps.map((m, i) => {
                          const cls = classes.find(c => c.id === m.classId);
                          if (!m.sectionId) {
                            return <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{cls?.name || '?'} (all)</span>;
                          }
                          const section = cls?.sections?.find(s => s.id === m.sectionId);
                          return <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{cls?.name || '?'} – {section?.name || '?'}</span>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Main Component ──────────────── */
export default function TeacherManager() {
  const {
    teachers, addTeacher, updateTeacher, deleteTeacher,
    teacherSubjectMap, showAlert
  } = useTimetable();

  // Add teacher form
  const [newTeacherName, setNewTeacherName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [autoGenerateId, setAutoGenerateId] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTeacherCode, setEditTeacherCode] = useState('');

  // Modal state
  const [modalTeacher, setModalTeacher] = useState(null);

  const generateTeacherCode = () => {
    const existingCodes = teachers
      .map(t => t.teacherCode)
      .filter(c => c && /^T\d+$/.test(c))
      .map(c => parseInt(c.slice(1)));
    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `T${String(nextNum).padStart(3, '0')}`;
  };

  const handleAutoGenerateToggle = (checked) => {
    setAutoGenerateId(checked);
    if (checked) setTeacherCode(generateTeacherCode());
    else setTeacherCode('');
  };

  const currentAutoCode = autoGenerateId ? generateTeacherCode() : teacherCode;

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName.trim()) { showAlert('Please enter teacher name', 'warning'); return; }
    if (teachers.some(t => t.name.toLowerCase() === newTeacherName.trim().toLowerCase())) {
      showAlert('A teacher with this name already exists', 'error'); return;
    }
    const finalCode = autoGenerateId ? generateTeacherCode() : teacherCode.trim();
    if (!finalCode) { showAlert('Please enter a Teacher ID or enable auto-generate', 'warning'); return; }
    if (teachers.some(t => t.teacherCode === finalCode)) { showAlert('This Teacher ID already exists', 'error'); return; }

    setSaving(true);
    try {
      await addTeacher(newTeacherName.trim(), finalCode);
      setNewTeacherName('');
      setTeacherCode('');
      showAlert('Teacher added successfully', 'success');
    } catch (err) { /* handled */ }
    setSaving(false);
  };

  // Edit handlers
  const startEditing = (teacher) => { setEditingTeacher(teacher.id); setEditName(teacher.name); setEditTeacherCode(teacher.teacherCode || ''); };

  const saveEdit = async () => {
    if (!editName.trim()) { showAlert('Please enter teacher name', 'warning'); return; }
    if (teachers.some(t => t.id !== editingTeacher && t.name.toLowerCase() === editName.trim().toLowerCase())) {
      showAlert('A teacher with this name already exists', 'error'); return;
    }
    if (editTeacherCode.trim() && teachers.some(t => t.id !== editingTeacher && t.teacherCode === editTeacherCode.trim())) {
      showAlert('This Teacher ID already exists', 'error'); return;
    }
    setSaving(true);
    try {
      await updateTeacher(editingTeacher, { name: editName.trim(), teacherCode: editTeacherCode.trim() || null });
      setEditingTeacher(null);
      showAlert('Teacher updated successfully', 'success');
    } catch (err) { /* handled */ }
    setSaving(false);
  };

  const cancelEdit = () => { setEditingTeacher(null); setEditName(''); setEditTeacherCode(''); };

  const handleDeleteTeacher = (teacherId, teacherName) => {
    if (window.confirm(`Are you sure you want to delete ${teacherName}?`)) {
      deleteTeacher(teacherId);
      showAlert('Teacher deleted', 'info');
    }
  };

  const getMappingCount = (teacherId) => teacherSubjectMap.filter(m => m.teacherId === teacherId).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Teacher Management</h2>
          <p className="text-slate-500">Add teachers and map subjects via the dedicated mapping view.</p>
        </div>
      </div>

      {/* Add New Teacher — simple form */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="text-green-600">+</span> Add New Teacher
        </h3>
        <form onSubmit={handleAddTeacher}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Teacher Name <span className="text-red-500">*</span></label>
              <input type="text" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="e.g., Mr. Smith" className="w-full max-w-md px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Teacher ID <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-4 max-w-md">
                <input type="text" value={autoGenerateId ? currentAutoCode : teacherCode} onChange={(e) => setTeacherCode(e.target.value)} placeholder="e.g., T001" disabled={autoGenerateId} className={`flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${autoGenerateId ? 'bg-slate-100 text-slate-500' : ''}`} />
                <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                  <input type="checkbox" checked={autoGenerateId} onChange={(e) => handleAutoGenerateToggle(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm text-slate-600">Auto-generate</span>
                </label>
              </div>
            </div>
            <div>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <Spinner />} Add Teacher
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Teachers List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 bg-slate-50 border-b">
          <h3 className="font-semibold text-slate-700">All Teachers ({teachers.length})</h3>
        </div>

        <div className="divide-y">
          {teachers.map(teacher => (
            <div key={teacher.id} className="p-5 hover:bg-slate-50/50 transition-colors">
              {editingTeacher === teacher.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Teacher ID</label>
                      <input type="text" value={editTeacherCode} onChange={(e) => setEditTeacherCode(e.target.value)} placeholder="e.g., T001" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50">
                      {saving && <Spinner />} Save
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 font-medium">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl">👨‍🏫</div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-lg">{teacher.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        {teacher.teacherCode && <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono text-xs">{teacher.teacherCode}</span>}
                        <span className="text-xs text-slate-400">{getMappingCount(teacher.id)} mapping{getMappingCount(teacher.id) !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setModalTeacher(teacher)} className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors">📚 Map Subjects</button>
                    <button onClick={() => startEditing(teacher)} className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors">✏️ Edit</button>
                    <button onClick={() => handleDeleteTeacher(teacher.id, teacher.name)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">🗑️ Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {teachers.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👨‍🏫</div>
              <p className="text-slate-400 text-lg">No teachers added yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first teacher using the form above</p>
            </div>
          )}
        </div>
      </div>

      {/* Map Subjects Modal */}
      {modalTeacher && <MapSubjectsModal teacher={modalTeacher} onClose={() => setModalTeacher(null)} />}
    </div>
  );
}
