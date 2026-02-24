import { useState, useRef, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function BatchOrder() {
  const { classes, updateSectionOrder, showAlert } = useTimetable();

  // Flatten all sections across classes into a single ordered list
  const allBatches = classes.flatMap(cls =>
    cls.sections.map(sec => ({
      id: sec.id,
      name: sec.name,
      classId: cls.id,
      className: cls.name,
      batchLabel: `${cls.name}-${sec.name}`,
      displayOrder: sec.displayOrder || 0,
    }))
  );

  const [orderedBatches, setOrderedBatches] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync orderedBatches when classes data loads or changes (only if no local edits)
  const prevIdsRef = useRef('');
  useEffect(() => {
    const currentIds = allBatches.map(b => b.id).join(',');
    if (!hasChanges && currentIds !== prevIdsRef.current) {
      setOrderedBatches(allBatches);
      prevIdsRef.current = currentIds;
    }
  }, [allBatches, hasChanges]);

  // Drag state
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const newList = [...orderedBatches];
    const draggedItem = newList.splice(dragItem.current, 1)[0];
    newList.splice(dragOverItem.current, 0, draggedItem);

    setOrderedBatches(newList);
    setHasChanges(true);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const orderedIds = orderedBatches.map(b => b.id);
      await updateSectionOrder(orderedIds);
      setHasChanges(false);
      prevBatchesRef.current = orderedBatches;
      showAlert('Batch order saved successfully', 'success');
    } catch (err) {
      /* already handled */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Batch</h2>
        <span className="text-slate-400">|</span>
        <span className="text-lg text-slate-600 font-medium">Set Order</span>
      </div>
      <p className="text-slate-500 mb-6">Drag and drop to reorder batches. This order will be used across the application.</p>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Table Header */}
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="w-12 px-4 py-3"></th>
              <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600 w-24">S.N.</th>
              <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">Batch Name</th>
              <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">Class</th>
            </tr>
          </thead>
          <tbody>
            {orderedBatches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  No batches created yet. Go to Add Batch to create some.
                </td>
              </tr>
            ) : (
              orderedBatches.map((batch, index) => (
                <tr
                  key={batch.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-b cursor-grab active:cursor-grabbing transition-colors hover:bg-blue-50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-400 text-lg select-none">⠿</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700 font-medium">{index + 1}</td>
                  <td className="px-5 py-3 text-sm text-slate-800">{batch.batchLabel}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{batch.className}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save Order Button */}
      {orderedBatches.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleSaveOrder}
            disabled={!hasChanges || saving}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      )}
    </div>
  );
}
