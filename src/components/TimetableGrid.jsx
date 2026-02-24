import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTimetable } from '../context/TimetableContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const MAX_TEACHER_PERIODS_PER_DAY = 6;

/* ──────────────── Auto-Generate Algorithm (Period-Consistent) ──────────────── */
function generateTimetableForSection({
  sectionId, classId, subjects, teacherSubjectMap, teacherSelections,
  classes, timetableData, pendingChanges, DAYS, PERIODS
}) {
  const teachingPeriods = PERIODS.filter(p => p !== 'Lunch');
  const section = classes.find(c => c.id === classId)?.sections?.find(s => s.id === sectionId);
  const sectionSubjectIds = section?.subjects || [];

  // Build subject requirements (use teacherSelections for single-teacher assignment)
  const requirements = [];
  for (const subId of sectionSubjectIds) {
    const subject = subjects.find(s => s.id === subId);
    if (!subject) continue;
    const ppw = subject.sectionPeriods?.[sectionId] ?? subject.classPeriods?.[classId] ?? 0;
    if (ppw === 0) continue;
    const selectedTeacher = teacherSelections?.[subId] || null;
    const allTeachers = [...new Set(
      teacherSubjectMap
        .filter(m => m.subjectId === subId && m.classId === classId && (!m.sectionId || m.sectionId === sectionId))
        .map(m => m.teacherId)
    )];
    requirements.push({
      subjectId: subId, subjectName: subject.name, periodsPerWeek: ppw,
      teacherId: selectedTeacher, teachers: allTeachers
    });
  }

  // Sort: most periods first (harder to fit), then fewest teachers
  requirements.sort((a, b) => {
    if (b.periodsPerWeek !== a.periodsPerWeek) return b.periodsPerWeek - a.periodsPerWeek;
    return a.teachers.length - b.teachers.length;
  });

  // Build global teacher busy map and daily period count from OTHER sections
  const teacherBusy = {};   // teacherBusy[tid][day][period] = true
  const teacherDayCount = {}; // teacherDayCount[tid][day] = number of periods
  for (const cls of classes) {
    for (const sec of cls.sections) {
      if (sec.id === sectionId) continue;
      const saved = timetableData[sec.id] || {};
      const pending = pendingChanges[sec.id] || {};
      for (const day of DAYS) {
        for (const period of teachingPeriods) {
          const cell = pending?.[day]?.[period] || saved?.[day]?.[period];
          if (cell?.teacherId) {
            const tid = cell.teacherId;
            if (!teacherBusy[tid]) teacherBusy[tid] = {};
            if (!teacherBusy[tid][day]) teacherBusy[tid][day] = {};
            teacherBusy[tid][day][period] = true;
            if (!teacherDayCount[tid]) teacherDayCount[tid] = {};
            teacherDayCount[tid][day] = (teacherDayCount[tid][day] || 0) + 1;
          }
        }
      }
    }
  }

  // Local trackers (within this generation)
  const localBusy = {};
  const localDayCount = {}; // incremental day count for this section

  const isTeacherFree = (tid, day, period) => {
    if (teacherBusy[tid]?.[day]?.[period] || localBusy[tid]?.[day]?.[period]) return false;
    const existingCount = (teacherDayCount[tid]?.[day] || 0) + (localDayCount[tid]?.[day] || 0);
    return existingCount < MAX_TEACHER_PERIODS_PER_DAY;
  };

  const markBusy = (tid, day, period) => {
    if (!localBusy[tid]) localBusy[tid] = {};
    if (!localBusy[tid][day]) localBusy[tid][day] = {};
    localBusy[tid][day][period] = true;
    if (!localDayCount[tid]) localDayCount[tid] = {};
    localDayCount[tid][day] = (localDayCount[tid][day] || 0) + 1;
  };

  const grid = {};
  for (const day of DAYS) grid[day] = {};
  const warnings = [];

  // ─── Period-Consistent Assignment ───
  for (const req of requirements) {
    const tid = req.teacherId;
    if (!tid) {
      warnings.push({ subjectName: req.subjectName, message: 'No teacher selected — skipped' });
      continue;
    }

    let remaining = req.periodsPerWeek;

    // Score each period slot: how many days is the teacher free at that period?
    const periodScores = teachingPeriods.map(period => {
      const freeDays = DAYS.filter(day => !grid[day][period] && isTeacherFree(tid, day, period));
      return { period, freeDays, score: freeDays.length };
    });

    // Sort by most available days (best consistency), break ties randomly
    periodScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });

    // Assign in period-consistent groups
    for (const { period, freeDays } of periodScores) {
      if (remaining <= 0) break;
      // Shuffle the free days for some randomization
      const shuffled = [...freeDays].sort(() => Math.random() - 0.5);
      for (const day of shuffled) {
        if (remaining <= 0) break;
        if (grid[day][period]) continue; // double-check slot still free
        if (!isTeacherFree(tid, day, period)) continue;
        grid[day][period] = { subjectId: req.subjectId, teacherId: tid };
        markBusy(tid, day, period);
        remaining--;
      }
    }

    if (remaining > 0) {
      warnings.push({
        subjectName: req.subjectName,
        message: `Only ${req.periodsPerWeek - remaining}/${req.periodsPerWeek} periods placed (teacher busy or slots full)`
      });
    }
  }

  return { grid, warnings, requirements };
}

/* ──────────────── Spinner ──────────────── */
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ──────────────── Generate Config Panel ──────────────── */
function GeneratePanel({ sectionSubjects, selectedClass, selectedSection, subjects, teachers, teacherSubjectMap, generating, onGenerate }) {
  // Teacher selection state: { [subjectId]: teacherId }
  const [teacherSelections, setTeacherSelections] = useState({});

  // Build requirements summary with mapped teacher info
  const reqs = sectionSubjects.map(sub => {
    const ppw = sub.sectionPeriods?.[selectedSection.id] ?? sub.classPeriods?.[selectedClass.id] ?? 0;
    const mappedTeacherIds = [...new Set(
      teacherSubjectMap
        .filter(m => m.subjectId === sub.id && m.classId === selectedClass.id && (!m.sectionId || m.sectionId === selectedSection.id))
        .map(m => m.teacherId)
    )];
    const mappedTeachers = mappedTeacherIds.map(tid => teachers.find(t => t.id === tid)).filter(Boolean);
    return { subject: sub, ppw, mappedTeachers, hasIssue: ppw === 0 || mappedTeachers.length === 0 };
  });

  // Auto-select teacher when only one is mapped
  useEffect(() => {
    const auto = {};
    for (const r of reqs) {
      if (r.mappedTeachers.length === 1) {
        auto[r.subject.id] = r.mappedTeachers[0].id;
      }
    }
    setTeacherSelections(prev => ({ ...auto, ...prev }));
  }, [sectionSubjects, teacherSubjectMap]);

  const totalPeriods = reqs.reduce((sum, r) => sum + r.ppw, 0);
  const hasIssues = reqs.some(r => r.hasIssue);
  const allTeachersSelected = reqs.every(r => r.hasIssue || teacherSelections[r.subject.id]);

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border p-6">
      <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span>📋</span> Subject Requirements & Teacher Selection
      </h3>
      <p className="text-xs text-slate-500 mb-4">Select one teacher per subject. The same teacher will teach this subject for the entire class.</p>

      {reqs.length === 0 ? (
        <p className="text-slate-400 text-sm">No subjects assigned to this section. Add subjects via Class Subject Map first.</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Subject</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 w-28">Periods/Week</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-600 min-w-[200px]">Assign Teacher</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                {reqs.map(r => {
                  const selected = teacherSelections[r.subject.id] || '';
                  const noTeacher = !selected && !r.hasIssue;
                  return (
                    <tr key={r.subject.id} className={`border-b last:border-b-0 ${r.hasIssue ? 'bg-red-50/50' : noTeacher ? 'bg-amber-50/50' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{r.subject.name}</td>
                      <td className="py-2.5 px-3 text-center">
                        {r.ppw > 0 ? (
                          <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{r.ppw}</span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Not set</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.mappedTeachers.length === 0 ? (
                          <span className="text-red-500 text-xs font-medium">No teachers mapped</span>
                        ) : r.mappedTeachers.length === 1 ? (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">{r.mappedTeachers[0].name} (auto)</span>
                        ) : (
                          <select
                            value={selected}
                            onChange={e => setTeacherSelections(prev => ({ ...prev, [r.subject.id]: e.target.value }))}
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${!selected ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                          >
                            <option value="">— Select teacher —</option>
                            {r.mappedTeachers.map(t => (
                              <option key={t.id} value={t.id}>{t.name}{t.teacherCode ? ` (${t.teacherCode})` : ''}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.hasIssue ? <span className="text-red-500">⚠️</span> : selected ? <span className="text-green-500">✓</span> : <span className="text-amber-500">⚠️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-slate-500">
              <span className="font-medium">{totalPeriods}</span> periods/week · <span className="font-medium">48</span> slots (8 × 6) · Teacher limit: <span className="font-medium">{MAX_TEACHER_PERIODS_PER_DAY}/day</span>
            </div>
            <button
              onClick={() => onGenerate(teacherSelections)}
              disabled={generating || hasIssues || totalPeriods === 0 || !allTeachersSelected}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <Spinner /> : <span>⚡</span>}
              {generating ? 'Generating…' : 'Generate Timetable'}
            </button>
          </div>
          {hasIssues && (
            <p className="text-xs text-amber-600 mt-2 text-right">Fix the issues above (set periods/week and map teachers) before generating.</p>
          )}
          {!hasIssues && !allTeachersSelected && (
            <p className="text-xs text-amber-600 mt-2 text-right">Select a teacher for every subject before generating.</p>
          )}
        </>
      )}
    </div>
  );
}

/* ──────────────── Component ──────────────── */
export default function TimetableGrid() {
  const {
    classes, subjects, teachers, teacherSubjectMap,
    DAYS, PERIODS,
    getMergedTimetable, assignPeriod, clearPeriod,
    saveChanges, discardChanges, applyGeneratedTimetable,
    hasPendingChanges, timetableData, pendingChanges,
    showAlert, showConfirmation, closeConfirmation, confirmDialog
  } = useTimetable();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClass, setSelectedClassLocal] = useState(null);
  const [selectedSection, setSelectedSectionLocal] = useState(null);

  // Sync from URL params on mount / when classes load
  useEffect(() => {
    const classId = searchParams.get('class');
    const sectionId = searchParams.get('section');
    if (classId && sectionId && classes.length > 0) {
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        const sec = cls.sections.find(s => s.id === sectionId);
        if (sec) {
          setSelectedClassLocal(cls);
          setSelectedSectionLocal(sec);
        }
      }
    }
  }, [searchParams, classes]);

  const setSelectedClass = (cls) => {
    setSelectedClassLocal(cls);
  };
  const setSelectedSection = (section, cls) => {
    setSelectedSectionLocal(section);
    const resolvedClass = cls || selectedClass;
    if (resolvedClass && section) {
      setSearchParams({ class: resolvedClass.id, section: section.id });
    }
  };

  const [selectedCell, setSelectedCell] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [expandedClasses, setExpandedClasses] = useState({});

  // Mode: 'create' = manual, 'generate' = auto
  const [mode, setMode] = useState('create');
  const [generatedGrid, setGeneratedGrid] = useState(null);
  const [generateWarnings, setGenerateWarnings] = useState([]);
  const [generateReqs, setGenerateReqs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ref for export
  const tableRef = useRef(null);

  // ──── Export dropdown state ────
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sort classes in ascending order
  const sortedClasses = [...classes].sort((a, b) => {
    const extractNumber = (name) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    return extractNumber(a.name) - extractNumber(b.name);
  });

  const toggleClass = (classId) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));
  };

  // Handle class click — auto-select if only 1 section, otherwise toggle expand
  const handleClassClick = (cls) => {
    if (cls.sections.length === 1) {
      setSelectedClass(cls);
      setSelectedSection(cls.sections[0], cls);
    } else {
      toggleClass(cls.id);
    }
  };

  // If no section selected, show selection prompt
  if (!selectedSection || !selectedClass) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Class Timetable</h2>
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Select a Class Section</h3>
            <p className="text-slate-500">Choose a class and section to view or edit the timetable</p>
          </div>
          
          <div className="max-w-2xl mx-auto space-y-2">
            {sortedClasses.map(cls => (
              <div key={cls.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => handleClassClick(cls)}
                  className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">{expandedClasses[cls.id] ? '📂' : '📁'}</span>
                    <span>{cls.name}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      {cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}
                    </span>
                    {cls.sections.length > 1 && (
                      <span className="text-slate-400">{expandedClasses[cls.id] ? '▲' : '▼'}</span>
                    )}
                  </div>
                </button>
                
                {expandedClasses[cls.id] && cls.sections.length > 1 && (
                  <div className="p-3 bg-white border-t">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {cls.sections.map(section => (
                        <button
                          key={section.id}
                          onClick={() => {
                            setSelectedClass(cls);
                            setSelectedSection(section, cls);
                          }}
                          className="px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-left"
                        >
                          <div className="text-sm">Section {section.name}</div>
                          <div className="text-xs text-indigo-500 mt-1">
                            {(section.subjects || []).length} subject{(section.subjects || []).length !== 1 ? 's' : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {sortedClasses.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-400">No classes created yet.</p>
                <p className="text-slate-400 text-sm mt-1">Go to Classes tab to add some.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const mergedTimetable = getMergedTimetable(selectedSection.id);
  const sectionSubjects = (selectedSection.subjects || []).map(subId => subjects.find(s => s.id === subId)).filter(Boolean);
  const teachingPeriods = PERIODS.filter(p => p !== 'Lunch');

  // Filter teachers who can teach the selected subject in this class via teacherSubjectMap
  const getAvailableTeachers = (subjectId) => {
    if (!subjectId || !selectedClass) return [];
    return teachers.filter(t =>
      teacherSubjectMap.some(m => m.teacherId === t.id && m.subjectId === subjectId && m.classId === selectedClass.id)
    );
  };

  // ──── Create mode helpers ────
  const handleCellClick = (day, period) => {
    if (period === 'Lunch' || mode !== 'create') return;
    setSelectedCell({ day, period });
    setSelectedSubject('');
    setSelectedTeacher('');
    setShowAssignModal(true);
  };

  const handleAssign = () => {
    if (!selectedSubject) {
      showAlert('Please select a subject', 'warning');
      return;
    }
    if (!selectedTeacher) {
      showAlert('Please select a teacher', 'warning');
      return;
    }

    // ── 6-period daily limit check ──
    const day = selectedCell.day;
    let teacherPeriodsToday = 0;
    for (const cls of classes) {
      for (const sec of cls.sections) {
        const saved = timetableData[sec.id] || {};
        const pending = pendingChanges[sec.id] || {};
        for (const p of teachingPeriods) {
          const cell = pending?.[day]?.[p] || saved?.[day]?.[p];
          if (cell?.teacherId === selectedTeacher) {
            // Skip the cell being reassigned
            if (sec.id === selectedSection.id && String(p) === String(selectedCell.period)) continue;
            teacherPeriodsToday++;
          }
        }
      }
    }
    if (teacherPeriodsToday >= MAX_TEACHER_PERIODS_PER_DAY) {
      const teacherName = getTeacherById(selectedTeacher)?.name;
      showAlert(`${teacherName} already has ${MAX_TEACHER_PERIODS_PER_DAY} periods on ${day}. Cannot assign more.`, 'error');
      return;
    }

    // Check if this cell already has an assignment
    const existingData = getCellData(selectedCell.day, selectedCell.period);
    if (existingData) {
      const existingSubject = getSubjectById(existingData.subjectId);
      const existingTeacher = getTeacherById(existingData.teacherId);
      
      // If it's the same teacher and same subject, allow it without confirmation
      if (existingData.teacherId === selectedTeacher && existingData.subjectId === selectedSubject) {
        showAlert('Same teacher and subject already assigned to this period', 'info');
        setShowAssignModal(false);
        return;
      }
      
      showConfirmation(
        `This period already has ${existingSubject?.name} with ${existingTeacher?.name}. Do you want to replace it?`,
        () => {
          // User confirmed replacement, now check for teacher conflict
          const result = assignPeriod(
            selectedSection.id,
            selectedCell.day,
            selectedCell.period,
            selectedSubject,
            selectedTeacher,
            true
          );

          if (!result.success) {
            // Teacher is busy elsewhere with DIFFERENT subject/class
            const conflict = result.conflict;
            // Check if teacher is teaching the same subject elsewhere
            let conflictSection = null;
            for (const c of classes) {
              const found = c.sections.find(s =>
                `${c.name} - Section ${s.name}` === `${conflict.conflictClass} - Section ${conflict.conflictSection}`
              );
              if (found) { conflictSection = found; break; }
            }
            
            showConfirmation(
              `${getTeacherById(selectedTeacher)?.name} is already assigned to ${result.conflict.conflictClass} - Section ${result.conflict.conflictSection} at this time. Replace that as well?`,
              () => {
                assignPeriod(
                  selectedSection.id,
                  selectedCell.day,
                  selectedCell.period,
                  selectedSubject,
                  selectedTeacher,
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
            showAlert('Period updated successfully', 'success');
          }
        },
        () => {
          closeConfirmation();
        }
      );
      return;
    }

    // No existing assignment, just check teacher availability
    const result = assignPeriod(
      selectedSection.id,
      selectedCell.day,
      selectedCell.period,
      selectedSubject,
      selectedTeacher
    );

    if (!result.success) {
      // Show confirmation dialog for conflict
      showConfirmation(
        `${result.conflict.teacherName} is already assigned to ${result.conflict.conflictClass} - Section ${result.conflict.conflictSection} at this time. Do you want to replace it?`,
        () => {
          // Force assign
          assignPeriod(
            selectedSection.id,
            selectedCell.day,
            selectedCell.period,
            selectedSubject,
            selectedTeacher,
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
      showAlert('Period assigned successfully', 'success');
    }
  };

  const handleClearCell = () => {
    clearPeriod(selectedSection.id, selectedCell.day, selectedCell.period);
    setShowAssignModal(false);
    showAlert('Period cleared', 'info');
  };

  const getCellData = (day, period) => {
    // In generate mode with a preview, show generated grid; otherwise show merged (saved+pending)
    if (mode === 'generate' && generatedGrid) {
      return generatedGrid[day]?.[period] || null;
    }
    return mergedTimetable?.[day]?.[period];
  };

  const getSubjectById = (id) => subjects.find(s => s.id === id);
  const getTeacherById = (id) => teachers.find(t => t.id === id);

  // ──── Generate mode handlers ────
  const handleGenerate = (teacherSelections) => {
    setGenerating(true);
    // Use setTimeout to let the spinner render
    setTimeout(() => {
      const result = generateTimetableForSection({
        sectionId: selectedSection.id,
        classId: selectedClass.id,
        subjects,
        teacherSubjectMap,
        teacherSelections,
        classes,
        timetableData,
        pendingChanges,
        DAYS,
        PERIODS
      });
      setGeneratedGrid(result.grid);
      setGenerateWarnings(result.warnings);
      setGenerateReqs(result.requirements);
      setGenerating(false);
    }, 50);
  };

  const handleApplyGenerated = async () => {
    if (!generatedGrid) return;
    setSaving(true);
    try {
      await applyGeneratedTimetable(selectedSection.id, generatedGrid);
      setGeneratedGrid(null);
      setGenerateWarnings([]);
    } catch { /* handled by context */ }
    setSaving(false);
  };

  const handleDiscardGenerated = () => {
    setGeneratedGrid(null);
    setGenerateWarnings([]);
    setGenerateReqs([]);
  };

  // Count subject occurrences on a given day (for subject-repeat warning in Create mode)
  const countSubjectOnDay = (subjectId, day, excludePeriod = null) => {
    let count = 0;
    for (const p of teachingPeriods) {
      if (excludePeriod != null && String(p) === String(excludePeriod)) continue;
      const cell = mergedTimetable?.[day]?.[p];
      if (cell?.subjectId === subjectId) count++;
    }
    return count;
  };

  // ──── Export helper: capture table to canvas ────
  const captureTable = async () => {
    const el = tableRef.current;
    if (!el) throw new Error('Table not found');
    // Temporarily expand overflow so html2canvas can see all content
    const scrollWrapper = el.querySelector('.overflow-x-auto');
    let prev = '';
    if (scrollWrapper) {
      prev = scrollWrapper.style.overflow;
      scrollWrapper.style.overflow = 'visible';
    }
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: el.scrollWidth + 40,
      });
      return canvas;
    } finally {
      if (scrollWrapper) scrollWrapper.style.overflow = prev;
    }
  };

  // ──── Export functions ────
  const exportToJPEG = async () => {
    setShowExportMenu(false);
    try {
      const canvas = await captureTable();
      const link = document.createElement('a');
      link.download = `${selectedClass.name}_Section_${selectedSection.name}_Timetable.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      showAlert('Timetable exported as JPEG', 'success');
    } catch (err) {
      console.error('JPEG export error:', err);
      showAlert('Failed to export JPEG: ' + err.message, 'error');
    }
  };

  const exportToPDF = async () => {
    setShowExportMenu(false);
    try {
      const canvas = await captureTable();
      const imgData = canvas.toDataURL('image/png');
      const pxToMm = 0.264583;
      const wMm = canvas.width * pxToMm;
      const hMm = canvas.height * pxToMm;
      const pdf = new jsPDF({ orientation: wMm > hMm ? 'landscape' : 'portrait', unit: 'mm', format: [wMm, hMm] });
      pdf.addImage(imgData, 'PNG', 0, 0, wMm, hMm);
      pdf.save(`${selectedClass.name}_Section_${selectedSection.name}_Timetable.pdf`);
      showAlert('Timetable exported as PDF', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showAlert('Failed to export PDF: ' + err.message, 'error');
    }
  };

  const exportToExcel = () => {
    setShowExportMenu(false);
    try {
      const rows = [];
      // Header row
      const header = ['Day / Period', ...PERIODS.map(p => p === 'Lunch' ? 'Lunch' : `Period ${p}`)];
      rows.push(header);
      // Data rows
      for (const day of DAYS) {
        const row = [day];
        for (const period of PERIODS) {
          if (period === 'Lunch') { row.push('Lunch Break'); continue; }
          const cellData = getCellData(day, period);
          if (cellData) {
            const sub = getSubjectById(cellData.subjectId);
            const teach = getTeacherById(cellData.teacherId);
            row.push(`${sub?.name || '?'} (${teach?.name || '?'})`);
          } else {
            row.push('');
          }
        }
        rows.push(row);
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Set column widths
      ws['!cols'] = header.map((_, i) => ({ wch: i === 0 ? 12 : 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${selectedClass.name} ${selectedSection.name}`);
      XLSX.writeFile(wb, `${selectedClass.name}_Section_${selectedSection.name}_Timetable.xlsx`);
      showAlert('Timetable exported as Excel', 'success');
    } catch {
      showAlert('Failed to export Excel', 'error');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {selectedClass.name} - Section {selectedSection.name}
          </h2>
          <p className="text-slate-500 text-sm">
            {mode === 'create' ? 'Click on a cell to assign subject and teacher' : 'Auto-generate timetable from your subject & teacher setup'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSelectedClass(null);
              setSelectedSection(null);
              setSearchParams({});
              setMode('create');
              setGeneratedGrid(null);
            }}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Change Section
          </button>
          {mode === 'create' && hasPendingChanges && (
            <>
              <button onClick={discardChanges} className="px-5 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium">
                ✕ Discard
              </button>
              <button onClick={saveChanges} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm">
                💾 Save
              </button>
            </>
          )}
          {mode === 'create' && !hasPendingChanges && (
            <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">✓ Saved</div>
          )}
        </div>
      </div>

      {/* Export Dropdown */}
      <div className="relative inline-block mb-4" ref={exportMenuRef}>
        <button
          onClick={() => setShowExportMenu(prev => !prev)}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          📥 Export
          <svg className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {showExportMenu && (
          <div className="absolute left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border z-30 py-1 animate-in fade-in">
            <button onClick={exportToJPEG} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
              📷 <span>Export as JPEG</span>
            </button>
            <button onClick={exportToPDF} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
              📄 <span>Export as PDF</span>
            </button>
            <button onClick={exportToExcel} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
              📊 <span>Export as Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 max-w-xs">
        <button
          onClick={() => { setMode('create'); setGeneratedGrid(null); setGenerateWarnings([]); }}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ✏️ Create
        </button>
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'generate' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ⚡ Generate
        </button>
      </div>

      {/* Generate Panel (shown in generate mode, above the grid) */}
      {mode === 'generate' && !generatedGrid && (
        <GeneratePanel
          sectionSubjects={sectionSubjects}
          selectedClass={selectedClass}
          selectedSection={selectedSection}
          subjects={subjects}
          teachers={teachers}
          teacherSubjectMap={teacherSubjectMap}
          generating={generating}
          onGenerate={handleGenerate}
        />
      )}

      {/* Generated timetable action bar */}
      {mode === 'generate' && generatedGrid && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-800">Timetable generated — preview below</p>
            {generateWarnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {generateWarnings.map((w, i) => (
                  <p key={i} className="text-sm text-amber-700 flex items-center gap-1">
                    <span>⚠️</span> <strong>{w.subjectName}:</strong> {w.message}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-4 flex-shrink-0">
            <button onClick={handleDiscardGenerated} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 font-medium">
              Discard
            </button>
            <button onClick={handleGenerate} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 font-medium">
              🔄 Re-generate
            </button>
            <button onClick={handleApplyGenerated} disabled={saving} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium flex items-center gap-2 disabled:opacity-50">
              {saving ? <Spinner /> : '💾'} Apply & Save
            </button>
          </div>
        </div>
      )}

      {/* Timetable Grid */}
      <div ref={tableRef} className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-3 bg-slate-50 border-b text-center">
          <span className="font-bold text-slate-700">{selectedClass.name} - Section {selectedSection.name} Timetable</span>
        </div>
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
                  <td className="px-4 py-3 font-medium text-slate-700 bg-slate-50">{day}</td>
                  {PERIODS.map((period, idx) => {
                    if (period === 'Lunch') {
                      return (
                        <td key={idx} className="bg-amber-50 text-center text-amber-600 text-xs">
                          Lunch<br/>Break
                        </td>
                      );
                    }

                    const cellData = getCellData(day, period);
                    const subject = cellData?.subjectId ? getSubjectById(cellData.subjectId) : null;
                    const teacher = cellData?.teacherId ? getTeacherById(cellData.teacherId) : null;
                    const isClickable = mode === 'create';

                    return (
                      <td 
                        key={idx}
                        onClick={() => isClickable && handleCellClick(day, period)}
                        className={`px-2 py-2 transition-all border-l ${
                          isClickable ? 'cursor-pointer hover:bg-indigo-50' : ''
                        } ${
                          cellData ? 'bg-orange-100 border-l-4 border-orange-500' : 'bg-white'
                        }`}
                      >
                        {cellData ? (
                          <div className="min-h-[60px]">
                            <div className="font-medium text-sm text-slate-800">{subject?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500 mt-1">{teacher?.name || 'Unknown'}</div>
                          </div>
                        ) : (
                          <div className="min-h-[60px] flex items-center justify-center">
                            {isClickable && <span className="text-slate-300 text-2xl">+</span>}
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

      {/* Subject Period Count Summary */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-5">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span>📊</span>
          <span>Period Count by Subject</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectionSubjects.map(subject => {
            let count = 0;
            DAYS.forEach(day => {
              PERIODS.forEach(period => {
                if (period !== 'Lunch') {
                  const cellData = getCellData(day, period);
                  if (cellData?.subjectId === subject.id) count++;
                }
              });
            });
            const required = subject.sectionPeriods?.[selectedSection.id] ?? subject.classPeriods?.[selectedClass.id] ?? 0;
            const isMatch = required > 0 && count === required;
            const isOver = required > 0 && count > required;
            const isUnder = required > 0 && count < required;
            
            return (
              <div key={subject.id} className={`p-3 rounded-lg border-l-4 ${
                isMatch ? 'bg-green-50 border-green-500' :
                isOver ? 'bg-red-50 border-red-400' :
                isUnder ? 'bg-amber-50 border-amber-400' :
                'bg-orange-100 border-orange-500'
              }`}>
                <div className="font-medium text-slate-800">{subject.name}</div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-bold text-slate-700">{count}</span>
                  {required > 0 && (
                    <span className={`text-sm font-medium ${isMatch ? 'text-green-600' : isOver ? 'text-red-500' : 'text-amber-600'}`}>/ {required}</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {required > 0 ? (isMatch ? '✓ matched' : isOver ? 'over by ' + (count - required) : 'need ' + (required - count) + ' more') : 'period' + (count !== 1 ? 's' : '') + ' / week'}
                </div>
              </div>
            );
          })}
          {sectionSubjects.length === 0 && (
            <div className="col-span-full text-center py-6">
              <p className="text-slate-400 text-sm">No subjects assigned to this section. Go to Classes tab to add subjects.</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Assign Period - {selectedCell?.day}, Period {selectedCell?.period}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedTeacher('');
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Subject</option>
                  {sectionSubjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                  {sectionSubjects.length === 0 && (
                    <option disabled>No subjects assigned to this section</option>
                  )}
                </select>
                {/* Subject-repeat-on-same-day warning */}
                {selectedSubject && selectedCell && countSubjectOnDay(selectedSubject, selectedCell.day, selectedCell.period) > 0 && (
                  <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                    <span>⚠️</span> This subject is already assigned on {selectedCell.day}. Assigning again will create a duplicate.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Teacher</label>
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={!selectedSubject}
                >
                  <option value="">Select Teacher</option>
                  {selectedSubject && getAvailableTeachers(selectedSubject).map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                  {selectedSubject && getAvailableTeachers(selectedSubject).length === 0 && (
                    <option disabled>No teachers available for this subject in this class</option>
                  )}
                </select>
                {selectedSubject && getAvailableTeachers(selectedSubject).length === 0 && (
                  <p className="text-amber-600 text-xs mt-1">
                    No teachers within class jurisdiction can teach this subject.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={handleClearCell}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                Clear Cell
              </button>
              <div className="flex gap-2">
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
