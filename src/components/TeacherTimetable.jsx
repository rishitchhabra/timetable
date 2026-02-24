import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTimetable } from '../context/TimetableContext';

export default function TeacherTimetable() {
  const { 
    teachers,
    classes,
    subjects,
    teacherSubjectMap,
    DAYS, 
    PERIODS,
    getTeacherTimetable,
    assignPeriod,
    clearPeriod,
    saveChanges,
    discardChanges,
    hasPendingChanges,
    showAlert,
    showConfirmation,
    closeConfirmation,
    confirmDialog,
    checkTeacherAvailability
  } = useTimetable();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeacher, setSelectedTeacherLocal] = useState(null);

  // Sync from URL params
  useEffect(() => {
    const teacherId = searchParams.get('teacher');
    if (teacherId && teachers.length > 0) {
      const t = teachers.find(t => t.id === teacherId);
      if (t) setSelectedTeacherLocal(t);
    }
  }, [searchParams, teachers]);

  const setSelectedTeacher = (teacher) => {
    setSelectedTeacherLocal(teacher);
    if (teacher) {
      setSearchParams({ teacher: teacher.id });
    }
  };

  const [selectedCell, setSelectedCell] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // If no teacher selected, show selection prompt
  if (!selectedTeacher) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Teacher Timetable</h2>
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <div className="text-6xl mb-4">👨‍🏫</div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">Select a Teacher</h3>
          <p className="text-slate-500 mb-6">Choose a teacher to view their schedule</p>
          
          <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
            {teachers.map(teacher => (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacher(teacher)}
                className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-left"
              >
                <div className="font-medium">{teacher.name}</div>
                <div className="text-xs text-indigo-500 mt-1">
                  {teacher.teacherCode || ''}
                </div>
              </button>
            ))}
            {teachers.length === 0 && (
              <p className="col-span-2 text-slate-400">No teachers added yet. Go to Teachers tab to add some.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const teacherSchedule = getTeacherTimetable(selectedTeacher.id);

  // Filter classes based on teacher's subject mappings (only classes where teacher has at least one mapping)
  const availableClasses = classes.filter(cls => {
    const hasMappings = teacherSubjectMap.some(m => m.teacherId === selectedTeacher.id && m.classId === cls.id);
    return hasMappings;
  });

  // Get available sections for the selected class
  const availableSections = selectedClassId 
    ? availableClasses.find(c => c.id === selectedClassId)?.sections || []
    : [];

  // Get subjects teachable by this teacher that are also in the selected section
  const getAvailableSubjects = () => {
    if (!selectedSectionId) return [];
    const section = classes
      .flatMap(c => c.sections)
      .find(s => s.id === selectedSectionId);
    
    if (!section) return [];
    
    // Find the class this section belongs to
    const parentClass = classes.find(c => c.sections.some(s => s.id === selectedSectionId));
    if (!parentClass) return [];
    
    return subjects.filter(sub => 
      section.subjects.includes(sub.id) && 
      teacherSubjectMap.some(m => m.teacherId === selectedTeacher.id && m.subjectId === sub.id && m.classId === parentClass.id)
    );
  };

  const handleCellClick = (day, period) => {
    if (period === 'Lunch') return;
    setSelectedCell({ day, period });
    setSelectedClassId('');
    setSelectedSectionId('');
    setSelectedSubjectId('');
    setShowAssignModal(true);
  };

  const handleAssign = () => {
    if (!selectedSectionId || !selectedSubjectId) {
      showAlert('Please select class, section, and subject', 'warning');
      return;
    }

    // Check if this period is already assigned to the teacher elsewhere
    const currentAssignment = getCellData(selectedCell.day, selectedCell.period);
    if (currentAssignment) {
      // Check if it's the same class and subject - if so, allow without confirmation
      if (currentAssignment.sectionId === selectedSectionId && 
          subjects.find(s => s.name === currentAssignment.subjectName)?.id === selectedSubjectId) {
        showAlert('Same class and subject already assigned to this period', 'info');
        setShowAssignModal(false);
        return;
      }
      
      showConfirmation(
        `You are currently teaching ${currentAssignment.subjectName} in ${currentAssignment.className} - Section ${currentAssignment.sectionName} at this time. Do you want to replace it?`,
        () => {
          // User wants to replace, now check if the target class period is free
          const result = assignPeriod(
            selectedSectionId,
            selectedCell.day,
            selectedCell.period,
            selectedSubjectId,
            selectedTeacher.id,
            true
          );

          if (!result.success) {
            showConfirmation(
              `${result.conflict.conflictClass} - Section ${result.conflict.conflictSection} already has a period assigned at this time. Replace it as well?`,
              () => {
                assignPeriod(
                  selectedSectionId,
                  selectedCell.day,
                  selectedCell.period,
                  selectedSubjectId,
                  selectedTeacher.id,
                  true
                );
                closeConfirmation();
                setShowAssignModal(false);
                showAlert('Period assigned (conflicts overridden)', 'warning');
              },
              () => {
                closeConfirmation();
              }
            );
          } else {
            closeConfirmation();
            setShowAssignModal(false);
            showAlert('Period assigned to teacher', 'success');
          }
        },
        () => {
          closeConfirmation();
        }
      );
      return;
    }

    // No current assignment for teacher, check if target class period is free
    const result = assignPeriod(
      selectedSectionId,
      selectedCell.day,
      selectedCell.period,
      selectedSubjectId,
      selectedTeacher.id
    );

    if (!result.success) {
      showConfirmation(
        `${result.conflict.conflictClass} - Section ${result.conflict.conflictSection} already has ${result.conflict.teacherName} assigned at this time. Do you want to replace it?`,
        () => {
          assignPeriod(
            selectedSectionId,
            selectedCell.day,
            selectedCell.period,
            selectedSubjectId,
            selectedTeacher.id,
            true
          );
          closeConfirmation();
          setShowAssignModal(false);
          showAlert('Period assigned (conflict overridden)', 'warning');
        },
        () => {
          closeConfirmation();
        }
      );
    } else {
      setShowAssignModal(false);
      showAlert('Period assigned to teacher', 'success');
    }
  };

  const handleClearFromTeacher = (day, period, sectionId) => {
    clearPeriod(sectionId, day, period);
    showAlert('Period cleared from teacher schedule', 'info');
  };

  const getCellData = (day, period) => {
    return teacherSchedule?.[day]?.[period];
  };

  // Calculate workload statistics
  const workloadStats = () => {
    let totalPeriods = 0;
    const dayWise = {};
    const subjectWise = {};
    const classWise = {};
    
    DAYS.forEach(day => {
      dayWise[day] = 0;
      PERIODS.forEach(period => {
        if (period !== 'Lunch' && teacherSchedule?.[day]?.[period]) {
          totalPeriods++;
          dayWise[day]++;
          
          const subjectName = teacherSchedule[day][period].subjectName;
          const className = teacherSchedule[day][period].className;
          
          if (subjectName) {
            subjectWise[subjectName] = (subjectWise[subjectName] || 0) + 1;
          }
          
          if (className) {
            const fullClass = `${className} - ${teacherSchedule[day][period].sectionName}`;
            classWise[fullClass] = (classWise[fullClass] || 0) + 1;
          }
        }
      });
    });

    return { totalPeriods, dayWise, subjectWise, classWise };
  };

  const stats = workloadStats();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{selectedTeacher.name}'s Schedule</h2>
          <p className="text-slate-500">
            {selectedTeacher.teacherCode ? `ID: ${selectedTeacher.teacherCode} | ` : ''}{teacherSubjectMap.filter(m => m.teacherId === selectedTeacher.id).length} subject-class mappings
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedTeacher(null)}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Change Teacher
          </button>
          {hasPendingChanges && (
            <>
              <button
                onClick={discardChanges}
                className="px-5 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium"
              >
                ✕ Discard Changes
              </button>
              <button
                onClick={saveChanges}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
              >
                💾 Save Changes
              </button>
            </>
          )}
          {!hasPendingChanges && (
            <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
              ✓ All changes saved
            </div>
          )}
        </div>
      </div>

      {/* Workload Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-indigo-600">{stats.totalPeriods}</div>
          <div className="text-sm text-slate-500">Total Periods/Week</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-green-600">
            {(48 - stats.totalPeriods)}
          </div>
          <div className="text-sm text-slate-500">Free Periods</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-amber-600">
            {Math.round(stats.totalPeriods / 6)}
          </div>
          <div className="text-sm text-slate-500">Avg Periods/Day</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-purple-600">
            {Math.max(...Object.values(stats.dayWise))}
          </div>
          <div className="text-sm text-slate-500">Max in a Day</div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-24">Day/Period</th>
                {PERIODS.map((period, idx) => (
                  <th 
                    key={idx} 
                    className={`px-2 py-3 text-center text-sm font-semibold ${
                      period === 'Lunch' 
                        ? 'bg-amber-100 text-amber-700 w-16' 
                        : 'text-slate-600 min-w-[100px]'
                    }`}
                  >
                    {period === 'Lunch' ? '🍽️' : `Period ${period}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="border-t">
                  <td className="px-4 py-3 font-medium text-slate-700 bg-slate-50">
                    <div>{day}</div>
                    <div className="text-xs text-slate-400">{stats.dayWise[day]} periods</div>
                  </td>
                  {PERIODS.map((period, idx) => {
                    if (period === 'Lunch') {
                      return (
                        <td key={idx} className="bg-amber-50 text-center text-amber-600 text-xs">
                          Lunch<br/>Break
                        </td>
                      );
                    }

                    const cellData = getCellData(day, period);

                    return (
                      <td 
                        key={idx}
                        onClick={() => handleCellClick(day, period)}
                        className={`px-2 py-2 cursor-pointer transition-all hover:bg-indigo-50 border-l ${
                          cellData ? 'bg-indigo-100 border-l-4 border-indigo-500' : 'bg-white'
                        }`}
                      >
                        {cellData ? (
                          <div className="min-h-[60px] relative group">
                            <div className="font-medium text-sm text-slate-800">{cellData.subjectName || 'N/A'}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {cellData.className} - {cellData.sectionName}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearFromTeacher(day, period, cellData.sectionId);
                              }}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs p-1 transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="min-h-[60px] flex items-center justify-center">
                            <span className="text-slate-300 text-2xl">+</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teaching Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject-wise breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>Periods by Subject</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.subjectWise).map(([subject, count]) => (
              <div key={subject} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                <span className="font-medium text-slate-700">{subject}</span>
                <span className="text-2xl font-bold text-indigo-600">{count}</span>
              </div>
            ))}
            {Object.keys(stats.subjectWise).length === 0 && (
              <p className="text-slate-400 text-sm py-4 text-center">No periods assigned yet</p>
            )}
          </div>
        </div>

        {/* Class-wise breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <span>🏫</span>
            <span>Periods by Class</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.classWise).map(([className, count]) => (
              <div key={className} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-slate-700">{className}</span>
                <span className="text-2xl font-bold text-green-600">{count}</span>
              </div>
            ))}
            {Object.keys(stats.classWise).length === 0 && (
              <p className="text-slate-400 text-sm py-4 text-center">No classes assigned yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Assign {selectedTeacher.name} - {selectedCell?.day}, Period {selectedCell?.period}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedSectionId('');
                    setSelectedSubjectId('');
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Class</option>
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                  {availableClasses.length === 0 && (
                    <option disabled>No classes within teacher's jurisdiction</option>
                  )}
                </select>
                {availableClasses.length === 0 && (
                  <p className="text-amber-600 text-xs mt-1">
                    No classes mapped for {selectedTeacher.name}. Assign subjects via Teacher Subject Map.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setSelectedSubjectId('');
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={!selectedClassId}
                >
                  <option value="">Select Section</option>
                  {availableSections.map(section => (
                    <option key={section.id} value={section.id}>Section {section.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={!selectedSectionId}
                >
                  <option value="">Select Subject</option>
                  {getAvailableSubjects().map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
                {selectedSectionId && getAvailableSubjects().length === 0 && (
                  <p className="text-amber-600 text-xs mt-1">
                    No matching subjects. Ensure this teacher can teach subjects assigned to this section.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="text-amber-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Conflict Detected</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Replace Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
