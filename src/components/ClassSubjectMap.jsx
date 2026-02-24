import { useState, useRef, useEffect, useCallback } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function ClassSubjectMap() {
  const {
    subjects,
    classes,
    assignSubjectToClass,
    removeSubjectFromClass,
    addSubjectToSection,
    removeSubjectFromSection,
    updateSubjectClassPeriods,
    updateSectionSubjectPeriods,
    showAlert
  } = useTimetable();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('all'); // 'all' or specific section id
  const [saving, setSaving] = useState(false);

  // Local state for drag-and-drop changes (not saved until user clicks Save)
  // { subjectId: periodsPerWeek }
  const [localMapped, setLocalMapped] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Drag state
  const [draggedSubjectId, setDraggedSubjectId] = useState(null);
  const [dragOver, setDragOver] = useState(null); // 'mapped' or 'unmapped'

  // Sort classes by display_order
  const sortedClasses = [...classes].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Get the relevant section IDs based on batch selection
  const getTargetSectionIds = useCallback(() => {
    if (!selectedClass) return [];
    if (selectedBatchId === 'all') return selectedClass.sections.map(s => s.id);
    return [selectedBatchId];
  }, [selectedClass, selectedBatchId]);

  // Build local state from current data when class/batch changes
  useEffect(() => {
    if (!selectedClassId || !selectedClass) {
      setLocalMapped({});
      setHasChanges(false);
      return;
    }

    const mapped = {};
    if (selectedBatchId === 'all') {
      // Show subjects assigned to this class (at class level)
      subjects.forEach(s => {
        if ((s.classIds || []).includes(selectedClassId)) {
          mapped[s.id] = (s.classPeriods || {})[selectedClassId] || 0;
        }
      });
    } else {
      // Show subjects assigned to this specific section
      subjects.forEach(s => {
        if ((s.sectionIds || []).includes(selectedBatchId)) {
          const sectionPeriods = (s.sectionPeriods || {})[selectedBatchId];
          const classPeriods = (s.classPeriods || {})[selectedClassId];
          mapped[s.id] = sectionPeriods ?? classPeriods ?? 0;
        }
      });
    }
    setLocalMapped(mapped);
    setHasChanges(false);
  }, [selectedClassId, selectedBatchId, subjects, selectedClass]);

  // Derived lists
  const mappedSubjects = subjects.filter(s => s.id in localMapped);
  const unmappedSubjects = subjects.filter(s => !(s.id in localMapped));

  // ─── Drag and Drop handlers ─────────────────────────────
  const handleDragStart = (e, subjectId) => {
    setDraggedSubjectId(subjectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subjectId);
  };

  const handleDragOverMapped = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver('mapped');
  };

  const handleDragOverUnmapped = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver('unmapped');
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDropOnMapped = (e) => {
    e.preventDefault();
    setDragOver(null);
    if (!draggedSubjectId) return;

    // Add to mapped if not already there
    if (!(draggedSubjectId in localMapped)) {
      setLocalMapped(prev => ({ ...prev, [draggedSubjectId]: 0 }));
      setHasChanges(true);
    }
    setDraggedSubjectId(null);
  };

  const handleDropOnUnmapped = (e) => {
    e.preventDefault();
    setDragOver(null);
    if (!draggedSubjectId) return;

    // Remove from mapped
    if (draggedSubjectId in localMapped) {
      setLocalMapped(prev => {
        const next = { ...prev };
        delete next[draggedSubjectId];
        return next;
      });
      setHasChanges(true);
    }
    setDraggedSubjectId(null);
  };

  const handleDragEnd = () => {
    setDraggedSubjectId(null);
    setDragOver(null);
  };

  // ─── Period change ──────────────────────────────────────
  const handlePeriodChange = (subjectId, value) => {
    const num = Math.min(6, Math.max(0, parseInt(value) || 0));
    setLocalMapped(prev => ({ ...prev, [subjectId]: num }));
    setHasChanges(true);
  };

  // ─── Remove from mapped (click X) ──────────────────────
  const handleRemoveFromMapped = (subjectId) => {
    setLocalMapped(prev => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    setHasChanges(true);
  };

  // ─── Add to mapped (click +) ───────────────────────────
  const handleAddToMapped = (subjectId) => {
    setLocalMapped(prev => ({ ...prev, [subjectId]: 0 }));
    setHasChanges(true);
  };

  // ─── Save Changes ──────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClassId) return;
    setSaving(true);

    try {
      const currentlyMappedIds = new Set(Object.keys(localMapped));

      if (selectedBatchId === 'all') {
        // Work at the class level
        const prevMappedIds = new Set(
          subjects.filter(s => (s.classIds || []).includes(selectedClassId)).map(s => s.id)
        );

        // Subjects to add (in local but not in DB)
        for (const subjectId of currentlyMappedIds) {
          if (!prevMappedIds.has(subjectId)) {
            await assignSubjectToClass(subjectId, selectedClassId);
          }
        }

        // Subjects to remove (in DB but not in local)
        for (const subjectId of prevMappedIds) {
          if (!currentlyMappedIds.has(subjectId)) {
            await removeSubjectFromClass(subjectId, selectedClassId);
          }
        }

        // Update periods for all mapped subjects
        for (const [subjectId, periods] of Object.entries(localMapped)) {
          await updateSubjectClassPeriods(subjectId, selectedClassId, periods);
        }
      } else {
        // Work at the section level
        const prevMappedIds = new Set(
          subjects.filter(s => (s.sectionIds || []).includes(selectedBatchId)).map(s => s.id)
        );

        // Subjects to add
        for (const subjectId of currentlyMappedIds) {
          if (!prevMappedIds.has(subjectId)) {
            await addSubjectToSection(selectedClassId, selectedBatchId, subjectId);
          }
        }

        // Subjects to remove
        for (const subjectId of prevMappedIds) {
          if (!currentlyMappedIds.has(subjectId)) {
            await removeSubjectFromSection(selectedClassId, selectedBatchId, subjectId);
          }
        }

        // Update periods for all mapped subjects
        for (const [subjectId, periods] of Object.entries(localMapped)) {
          await updateSectionSubjectPeriods(selectedBatchId, subjectId, periods);
        }
      }

      setHasChanges(false);
      showAlert('Changes saved successfully!', 'success');
    } catch (err) {
      showAlert('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Discard ────────────────────────────────────────────
  const handleDiscard = () => {
    // Re-trigger the effect by toggling
    const cls = selectedClassId;
    const batch = selectedBatchId;
    setSelectedClassId('');
    setTimeout(() => {
      setSelectedClassId(cls);
      setSelectedBatchId(batch);
    }, 0);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Class Subject Map</h2>
      <p className="text-slate-500 mb-6">
        Drag subjects between panels to map/unmap. Set periods per week (max 6). Save when done.
      </p>

      {/* Class Selector */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Class</label>
        <select
          value={selectedClassId}
          onChange={(e) => { setSelectedClassId(e.target.value); setSelectedBatchId('all'); }}
          className="w-full max-w-sm px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          <option value="">-- Choose a class --</option>
          {sortedClasses.map(cls => (
            <option key={cls.id} value={cls.id}>
              {cls.name} ({cls.sections.length} batch{cls.sections.length !== 1 ? 'es' : ''})
            </option>
          ))}
        </select>
      </div>

      {/* Batch Selector */}
      {selectedClassId && selectedClass && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Batch</label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full max-w-sm px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="all">All Batches</option>
            {selectedClass.sections.map(sec => (
              <option key={sec.id} value={sec.id}>
                {selectedClass.name} - {sec.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-2">
            {selectedBatchId === 'all'
              ? 'Changes will apply to all batches in this class.'
              : 'Changes will apply only to this specific batch.'}
          </p>
        </div>
      )}

      {/* Drag & Drop Panels */}
      {selectedClassId && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Unmapped Subjects Panel */}
            <div
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                dragOver === 'unmapped' ? 'ring-2 ring-red-400 bg-red-50' : ''
              }`}
              onDragOver={handleDragOverUnmapped}
              onDragLeave={handleDragLeave}
              onDrop={handleDropOnUnmapped}
            >
              <div className="p-4 bg-slate-100 border-b">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  Un-mapped Subjects ({unmappedSubjects.length})
                </h3>
                <p className="text-xs text-slate-400 mt-1">Drag a subject to the right panel to map it</p>
              </div>
              <div className="p-4 min-h-[200px]">
                {unmappedSubjects.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm py-8">
                    {subjects.length === 0 ? 'No subjects created yet' : 'All subjects are mapped!'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unmappedSubjects.map(subject => (
                      <div
                        key={subject.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, subject.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                          ${draggedSubjectId === subject.id
                            ? 'opacity-40 border-dashed border-slate-400'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">⠿</span>
                          <span className="text-sm font-medium text-slate-700">{subject.name}</span>
                        </div>
                        <button
                          onClick={() => handleAddToMapped(subject.id)}
                          className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Add to class"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mapped Subjects Panel */}
            <div
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                dragOver === 'mapped' ? 'ring-2 ring-green-400 bg-green-50' : ''
              }`}
              onDragOver={handleDragOverMapped}
              onDragLeave={handleDragLeave}
              onDrop={handleDropOnMapped}
            >
              <div className="p-4 bg-orange-50 border-b">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <span className="text-lg">📚</span>
                  Subjects in {selectedClass?.name}
                  {selectedBatchId !== 'all' && ` - ${selectedClass?.sections.find(s => s.id === selectedBatchId)?.name}`}
                  {' '}({mappedSubjects.length})
                </h3>
                <p className="text-xs text-slate-400 mt-1">Set periods per week for each subject (max 6)</p>
              </div>
              <div className="p-4 min-h-[200px]">
                {mappedSubjects.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-lg">
                    Drop subjects here to map them
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mappedSubjects.map((subject, index) => (
                      <div
                        key={subject.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, subject.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all
                          ${draggedSubjectId === subject.id
                            ? 'opacity-40 border-dashed border-slate-400'
                            : 'bg-orange-50/50 hover:bg-orange-50 border-orange-200 hover:shadow-sm'
                          }`}
                      >
                        <span className="text-slate-400 text-sm">⠿</span>
                        <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
                        <span className="text-sm font-medium text-slate-700 flex-1">{subject.name}</span>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500 whitespace-nowrap">Periods/Wk:</label>
                          <input
                            type="number"
                            min="0"
                            max="6"
                            value={localMapped[subject.id] || 0}
                            onChange={(e) => handlePeriodChange(subject.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 px-2 py-1 text-center border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          />
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromMapped(subject.id); }}
                          className="text-red-400 hover:text-red-600 transition-colors px-1"
                          title="Remove from class"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save / Discard Bar */}
          <div className={`sticky bottom-0 bg-white rounded-xl shadow-lg border p-4 flex items-center justify-between transition-opacity ${
            hasChanges ? 'opacity-100' : 'opacity-60 pointer-events-none'
          }`}>
            <div className="text-sm text-slate-600">
              {hasChanges ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  You have unsaved changes
                </span>
              ) : (
                'No changes to save'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                disabled={!hasChanges || saving}
                className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Saving...
                  </>
                ) : (
                  '💾 Save Changes'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {!selectedClassId && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-slate-400">
          Select a class above to manage its subject mappings
        </div>
      )}
    </div>
  );
}
