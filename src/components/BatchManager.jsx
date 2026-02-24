import { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function BatchManager() {
  const {
    classes,
    addSection,
    deleteSection,
    updateSection,
    showAlert
  } = useTimetable();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [editingBatch, setEditingBatch] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // All batches (sections) flattened across all classes
  const allBatches = classes.flatMap(cls =>
    cls.sections.map(sec => ({
      ...sec,
      classId: cls.id,
      className: cls.name,
      batchLabel: `${cls.name}-${sec.name}`
    }))
  );

  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!selectedClassId || !batchName.trim()) return;
    // Duplicate batch name within same class
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (selectedClass && selectedClass.sections.some(s => s.name.toLowerCase() === batchName.trim().toLowerCase())) {
      showAlert('A batch with this name already exists in this class', 'error');
      return;
    }
    setSaving(true);
    try {
      await addSection(selectedClassId, batchName.trim());
      setBatchName('');
      showAlert('Batch created successfully', 'success');
    } catch (err) { /* already handled */ }
    setSaving(false);
  };

  const handleStartEdit = (batch) => {
    setEditingBatch(batch.id);
    setEditName(batch.name);
  };

  const handleSaveEdit = async (batch) => {
    if (!editName.trim()) return;
    // Duplicate batch name check within same class (exclude self)
    const parentClass = classes.find(c => c.id === batch.classId);
    if (parentClass && parentClass.sections.some(s => s.id !== batch.id && s.name.toLowerCase() === editName.trim().toLowerCase())) {
      showAlert('A batch with this name already exists in this class', 'error');
      return;
    }
    try {
      await updateSection(batch.id, { name: editName.trim() });
      setEditingBatch(null);
      setEditName('');
      showAlert('Batch updated successfully', 'success');
    } catch (err) { /* already handled */ }
  };

  const handleCancelEdit = () => {
    setEditingBatch(null);
    setEditName('');
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm(`Delete batch "${batch.batchLabel}"? This will remove all timetable entries for this batch.`)) return;
    try {
      await deleteSection(batch.classId, batch.id);
      showAlert('Batch deleted', 'success');
    } catch (err) { /* already handled */ }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Batch Management</h2>
      <p className="text-slate-500 mb-6">Create batches (sections) for classes and manage them</p>

      {/* Create Batch Form — like Image 3 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">Create Batch</h3>
        <form onSubmit={handleAddBatch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50"
              >
                <option value="">Select Class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Batch Name</label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Batch Name"
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!selectedClassId || !batchName.trim() || saving}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Create Batch
          </button>
        </form>
      </div>

      {/* Active Batches Table — like Image 4 with columns: S.No, Batch, Class, Edit */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-3 bg-indigo-600 border-b">
          <h3 className="font-semibold text-white">Active Batches</h3>
        </div>

        {allBatches.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No batches created yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600 w-20">S. No.</th>
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">Batch</th>
                  <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">Class</th>
                  <th className="px-5 py-3 text-right text-sm font-semibold text-slate-600 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allBatches.map((batch, index) => (
                  <tr key={batch.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-5 py-3 text-sm text-slate-700">{index + 1}</td>
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                      {editingBatch === batch.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(batch);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="px-3 py-1 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-40"
                          autoFocus
                        />
                      ) : (
                        batch.batchLabel
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{batch.className}</td>
                    <td className="px-5 py-3 text-right">
                      {editingBatch === batch.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSaveEdit(batch)}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStartEdit(batch)}
                            className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                            title="Edit batch"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(batch)}
                            className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="Delete batch"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
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
