import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import apiService from '../services/api';

const TimetableContext = createContext();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 'Lunch', 5, 6, 7, 8];

export function TimetableProvider({ children }) {
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Classes with sections
  const [classes, setClasses] = useState([]);

  // Teachers
  const [teachers, setTeachers] = useState([]);

  // Subjects
  const [subjects, setSubjects] = useState([]);

  // Teacher Subject Map: [{ teacherId, subjectId, classId }]
  const [teacherSubjectMap, setTeacherSubjectMap] = useState([]);

  // Timetable data: { [sectionId]: { [day]: { [period]: { subjectId, teacherId } } } }
  const [timetableData, setTimetableData] = useState({});

  // Load all data from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [classesData, teachersData, subjectsData, timetableDataResult, teacherSubjectMapData] = await Promise.all([
          apiService.getClasses(),
          apiService.getTeachers(),
          apiService.getSubjects(),
          apiService.getTimetable(),
          apiService.getTeacherSubjectMap()
        ]);
        
        setClasses(classesData);
        setTeachers(teachersData);
        setSubjects(subjectsData);
        setTimetableData(timetableDataResult);
        setTeacherSubjectMap(teacherSubjectMapData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Pending changes (before save)
  const [pendingChanges, setPendingChanges] = useState({});

  // Alert state
  const [alert, setAlert] = useState(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Get subject color class (always orange now)
  const getSubjectColor = () => {
    return 'bg-orange-100 border-l-4 border-orange-500';
  };

  // Add class
  const addClass = useCallback(async (name) => {
    const newClass = {
      id: uuidv4(),
      name,
      sections: []
    };
    try {
      await apiService.createClass(newClass);
      setClasses(prev => [...prev, newClass]);
      return newClass;
    } catch (err) {
      showAlert('Failed to add class: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Add section to class
  const addSection = useCallback(async (classId, sectionName) => {
    const newSectionId = uuidv4();
    try {
      const result = await apiService.createSection({
        id: newSectionId,
        classId: classId,
        name: sectionName
      });
      const autoSubjects = result.subjects || [];
      setClasses(prev => prev.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            sections: [...cls.sections, { id: newSectionId, name: sectionName, subjects: autoSubjects }]
          };
        }
        return cls;
      }));
      // Update subjects state — add new section to their sectionIds
      if (autoSubjects.length > 0) {
        setSubjects(prev => prev.map(s => {
          if (autoSubjects.includes(s.id)) {
            return { ...s, sectionIds: [...(s.sectionIds || []), newSectionId] };
          }
          return s;
        }));
      }
    } catch (err) {
      showAlert('Failed to add section: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Add subject to section
  const addSubjectToSection = useCallback(async (classId, sectionId, subjectId) => {
    try {
      await apiService.addSubjectToSection(sectionId, subjectId);
      setClasses(prev => prev.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            sections: cls.sections.map(sec => {
              if (sec.id === sectionId && !sec.subjects.includes(subjectId)) {
                return { ...sec, subjects: [...sec.subjects, subjectId] };
              }
              return sec;
            })
          };
        }
        return cls;
      }));
      // Also update subjects state
      setSubjects(prev => prev.map(s => {
        if (s.id === subjectId && !(s.sectionIds || []).includes(sectionId)) {
          return { ...s, sectionIds: [...(s.sectionIds || []), sectionId] };
        }
        return s;
      }));
    } catch (err) {
      showAlert('Failed to add subject to section: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Remove subject from section
  const removeSubjectFromSection = useCallback(async (classId, sectionId, subjectId) => {
    try {
      await apiService.removeSubjectFromSection(sectionId, subjectId);
      setClasses(prev => prev.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            sections: cls.sections.map(sec => {
              if (sec.id === sectionId) {
                return { ...sec, subjects: sec.subjects.filter(s => s !== subjectId) };
              }
              return sec;
            })
          };
        }
        return cls;
      }));
      // Also update subjects state
      setSubjects(prev => prev.map(s => {
        if (s.id === subjectId) {
          return { ...s, sectionIds: (s.sectionIds || []).filter(id => id !== sectionId) };
        }
        return s;
      }));
    } catch (err) {
      showAlert('Failed to remove subject from section: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Add teacher
  const addTeacher = useCallback(async (name, teacherCode = null) => {
    const newTeacher = {
      id: uuidv4(),
      name,
      teacherCode,
    };
    try {
      await apiService.createTeacher(newTeacher);
      setTeachers(prev => [...prev, newTeacher]);
      return newTeacher;
    } catch (err) {
      showAlert('Failed to add teacher: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Update teacher
  const updateTeacher = useCallback(async (teacherId, updates) => {
    try {
      const currentTeacher = teachers.find(t => t.id === teacherId);
      const updatedTeacher = { ...currentTeacher, ...updates };
      await apiService.updateTeacher(updatedTeacher);
      setTeachers(prev => prev.map(t => 
        t.id === teacherId ? { ...t, ...updates } : t
      ));
    } catch (err) {
      showAlert('Failed to update teacher: ' + err.message, 'error');
      throw err;
    }
  }, [teachers]);

  // Delete teacher
  const deleteTeacher = useCallback(async (teacherId) => {
    try {
      await apiService.deleteTeacher(teacherId);
      setTeachers(prev => prev.filter(t => t.id !== teacherId));
    } catch (err) {
      showAlert('Failed to delete teacher: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Add subject
  const addSubject = useCallback(async (name, classIds = []) => {
    const newSubject = {
      id: uuidv4(),
      name,
      classIds,
      sectionIds: []
    };
    try {
      const result = await apiService.createSubject({ id: newSubject.id, name, classIds });
      const sectionIds = result.sectionIds || [];
      setSubjects(prev => [...prev, { ...newSubject, sectionIds }]);
      // Update classes state to reflect new section_subjects
      if (classIds.length > 0 && sectionIds.length) {
        setClasses(prev => prev.map(cls => {
          if (!classIds.includes(cls.id)) return cls;
          return {
            ...cls,
            sections: cls.sections.map(sec => {
              if (sectionIds.includes(sec.id) && !sec.subjects.includes(newSubject.id)) {
                return { ...sec, subjects: [...sec.subjects, newSubject.id] };
              }
              return sec;
            })
          };
        }));
      }
      return newSubject;
    } catch (err) {
      showAlert('Failed to add subject: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Delete subject
  const deleteSubject = useCallback(async (subjectId) => {
    try {
      await apiService.deleteSubject(subjectId);
      setSubjects(prev => prev.filter(s => s.id !== subjectId));
      // Also clean up from classes/sections state
      setClasses(prev => prev.map(cls => ({
        ...cls,
        sections: cls.sections.map(sec => ({
          ...sec,
          subjects: sec.subjects.filter(id => id !== subjectId)
        }))
      })));
    } catch (err) {
      showAlert('Failed to delete subject: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Assign subject to a class (adds to all sections)
  const assignSubjectToClass = useCallback(async (subjectId, classId) => {
    try {
      const result = await apiService.assignSubjectToClass(subjectId, classId);
      const newSectionIds = result.sectionIds || [];
      setSubjects(prev => prev.map(s => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          classIds: [...new Set([...(s.classIds || []), classId])],
          sectionIds: [...new Set([...(s.sectionIds || []), ...newSectionIds])]
        };
      }));
      setClasses(prev => prev.map(cls => {
        if (cls.id !== classId) return cls;
        return {
          ...cls,
          sections: cls.sections.map(sec => {
            if (!sec.subjects.includes(subjectId)) {
              return { ...sec, subjects: [...sec.subjects, subjectId] };
            }
            return sec;
          })
        };
      }));
    } catch (err) {
      showAlert('Failed to assign subject to class: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Remove subject from a class (removes from all sections of that class)
  const removeSubjectFromClass = useCallback(async (subjectId, classId) => {
    try {
      const result = await apiService.removeSubjectFromClass(subjectId, classId);
      const removedSectionIds = result.removedSectionIds || [];
      setSubjects(prev => prev.map(s => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          classIds: (s.classIds || []).filter(id => id !== classId),
          sectionIds: (s.sectionIds || []).filter(id => !removedSectionIds.includes(id))
        };
      }));
      setClasses(prev => prev.map(cls => {
        if (cls.id !== classId) return cls;
        return {
          ...cls,
          sections: cls.sections.map(sec => ({
            ...sec,
            subjects: sec.subjects.filter(id => id !== subjectId)
          }))
        };
      }));
    } catch (err) {
      showAlert('Failed to remove subject from class: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Update periods per week for subject-class
  const updateSubjectClassPeriods = useCallback(async (subjectId, classId, periodsPerWeek) => {
    try {
      await apiService.updateSubjectClassPeriods(subjectId, classId, periodsPerWeek);
      setSubjects(prev => prev.map(s => {
        if (s.id !== subjectId) return s;
        return { ...s, classPeriods: { ...(s.classPeriods || {}), [classId]: periodsPerWeek } };
      }));
    } catch (err) {
      showAlert('Failed to update periods: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Update periods per week for section-subject (override)
  const updateSectionSubjectPeriods = useCallback(async (sectionId, subjectId, periodsPerWeek) => {
    try {
      await apiService.updateSectionSubjectPeriods(sectionId, subjectId, periodsPerWeek);
      setSubjects(prev => prev.map(s => {
        if (s.id !== subjectId) return s;
        return { ...s, sectionPeriods: { ...(s.sectionPeriods || {}), [sectionId]: periodsPerWeek } };
      }));
    } catch (err) {
      showAlert('Failed to update section periods: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Teacher Subject Map CRUD
  const addTeacherSubjectMapping = useCallback(async (teacherId, subjectId, classId, sectionId = null) => {
    try {
      await apiService.addTeacherSubjectMapping(teacherId, subjectId, classId, sectionId);
      setTeacherSubjectMap(prev => {
        const exists = prev.some(m => m.teacherId === teacherId && m.subjectId === subjectId && m.classId === classId && m.sectionId === sectionId);
        if (exists) return prev;
        return [...prev, { teacherId, subjectId, classId, sectionId }];
      });
    } catch (err) {
      showAlert('Failed to add teacher-subject mapping: ' + err.message, 'error');
      throw err;
    }
  }, []);

  const removeTeacherSubjectMapping = useCallback(async (teacherId, subjectId, classId, sectionId = null) => {
    try {
      await apiService.removeTeacherSubjectMapping(teacherId, subjectId, classId, sectionId);
      setTeacherSubjectMap(prev => prev.filter(
        m => !(m.teacherId === teacherId && m.subjectId === subjectId && m.classId === classId && m.sectionId === sectionId)
      ));
    } catch (err) {
      showAlert('Failed to remove teacher-subject mapping: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Delete class
  const deleteClass = useCallback(async (classId) => {
    try {
      await apiService.deleteClass(classId);
      setClasses(prev => prev.filter(c => c.id !== classId));
    } catch (err) {
      showAlert('Failed to delete class: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Delete section
  const deleteSection = useCallback(async (classId, sectionId) => {
    try {
      await apiService.deleteSection(sectionId);
      setClasses(prev => prev.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            sections: cls.sections.filter(s => s.id !== sectionId)
          };
        }
        return cls;
      }));
    } catch (err) {
      showAlert('Failed to delete section: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Update section (rename)
  const updateSection = useCallback(async (sectionId, updates) => {
    try {
      await apiService.updateSection({ id: sectionId, ...updates });
      setClasses(prev => prev.map(cls => ({
        ...cls,
        sections: cls.sections.map(sec =>
          sec.id === sectionId ? { ...sec, ...updates } : sec
        )
      })));
    } catch (err) {
      showAlert('Failed to update section: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Reorder classes
  const updateClassOrder = useCallback(async (orderedIds) => {
    try {
      await apiService.updateClassOrder(orderedIds);
      setClasses(prev => {
        const classMap = Object.fromEntries(prev.map(c => [c.id, c]));
        return orderedIds.map((id, i) => ({ ...classMap[id], displayOrder: i })).filter(Boolean);
      });
    } catch (err) {
      showAlert('Failed to update class order: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Reorder sections (batches)
  const updateSectionOrder = useCallback(async (orderedIds) => {
    try {
      await apiService.updateSectionOrder(orderedIds);
      // Update display order in classes state
      setClasses(prev => prev.map(cls => {
        const updatedSections = cls.sections.map(sec => {
          const idx = orderedIds.indexOf(sec.id);
          return idx >= 0 ? { ...sec, displayOrder: idx } : sec;
        });
        updatedSections.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        return { ...cls, sections: updatedSections };
      }));
    } catch (err) {
      showAlert('Failed to update section order: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Check if teacher is available at a specific slot
  const checkTeacherAvailability = useCallback((teacherId, day, period, excludeSectionId = null) => {
    // Check in saved timetable data
    for (const sectionId in timetableData) {
      if (excludeSectionId && sectionId === excludeSectionId) continue;
      const sectionData = timetableData[sectionId];
      if (sectionData?.[day]?.[period]?.teacherId === teacherId) {
        // Find which class/section this is
        for (const cls of classes) {
          const section = cls.sections.find(s => s.id === sectionId);
          if (section) {
            return { available: false, conflictClass: cls.name, conflictSection: section.name };
          }
        }
        return { available: false, conflictClass: 'Unknown', conflictSection: 'Unknown' };
      }
    }
    
    // Check in pending changes
    for (const sectionId in pendingChanges) {
      if (excludeSectionId && sectionId === excludeSectionId) continue;
      const sectionData = pendingChanges[sectionId];
      if (sectionData?.[day]?.[period]?.teacherId === teacherId) {
        for (const cls of classes) {
          const section = cls.sections.find(s => s.id === sectionId);
          if (section) {
            return { available: false, conflictClass: cls.name, conflictSection: section.name };
          }
        }
        return { available: false, conflictClass: 'Unknown', conflictSection: 'Unknown' };
      }
    }
    
    return { available: true };
  }, [timetableData, pendingChanges, classes]);

  // Assign period (adds to pending changes)
  const assignPeriod = useCallback((sectionId, day, period, subjectId, teacherId, force = false) => {
    // Check teacher availability
    if (teacherId && !force) {
      const availability = checkTeacherAvailability(teacherId, day, period, sectionId);
      if (!availability.available) {
        const teacher = teachers.find(t => t.id === teacherId);
        return {
          success: false,
          conflict: {
            teacherName: teacher?.name,
            conflictClass: availability.conflictClass,
            conflictSection: availability.conflictSection,
            day,
            period
          }
        };
      }
    }

    setPendingChanges(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [day]: {
          ...prev[sectionId]?.[day],
          [period]: { subjectId, teacherId }
        }
      }
    }));

    return { success: true };
  }, [checkTeacherAvailability, teachers]);

  // Clear period from pending changes
  const clearPeriod = useCallback((sectionId, day, period) => {
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      if (newChanges[sectionId]?.[day]) {
        delete newChanges[sectionId][day][period];
      }
      return newChanges;
    });
  }, []);

  // Save pending changes to timetable data and API
  const saveChanges = useCallback(async () => {
    try {
      // Convert pending changes to entries array for bulk save
      const entries = [];
      for (const sectionId in pendingChanges) {
        for (const day in pendingChanges[sectionId]) {
          for (const period in pendingChanges[sectionId][day]) {
            const entry = pendingChanges[sectionId][day][period];
            entries.push({
              sectionId,
              day,
              period: String(period),
              subjectId: entry.subjectId,
              teacherId: entry.teacherId
            });
          }
        }
      }

      if (entries.length > 0) {
        await apiService.saveTimetableEntries(entries);
      }

      setTimetableData(prev => {
        const newData = { ...prev };
        for (const sectionId in pendingChanges) {
          newData[sectionId] = {
            ...newData[sectionId],
            ...pendingChanges[sectionId]
          };
          for (const day in pendingChanges[sectionId]) {
            newData[sectionId][day] = {
              ...newData[sectionId]?.[day],
              ...pendingChanges[sectionId][day]
            };
          }
        }
        return newData;
      });
      setPendingChanges({});
      showAlert('Changes saved successfully!', 'success');
    } catch (err) {
      showAlert('Failed to save changes: ' + err.message, 'error');
      throw err;
    }
  }, [pendingChanges]);

  // Discard pending changes
  const discardChanges = useCallback(() => {
    setPendingChanges({});
    showAlert('Changes discarded', 'info');
  }, []);

  // Apply a generated timetable grid for a section (clear + save in one shot)
  const applyGeneratedTimetable = useCallback(async (sectionId, grid) => {
    try {
      // 1. Delete all existing entries for this section from DB
      await apiService.clearSectionTimetable(sectionId);

      // 2. Build entries from the generated grid
      const entries = [];
      for (const day in grid) {
        for (const period in grid[day]) {
          const cell = grid[day][period];
          if (cell) {
            entries.push({
              sectionId,
              day,
              period: String(period),
              subjectId: cell.subjectId,
              teacherId: cell.teacherId
            });
          }
        }
      }

      // 3. Save new entries in bulk
      if (entries.length > 0) {
        await apiService.saveTimetableEntries(entries);
      }

      // 4. Update local state — replace this section's timetable entirely
      setTimetableData(prev => ({ ...prev, [sectionId]: grid }));
      // Clear any pending changes for this section
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });

      showAlert('Generated timetable saved successfully!', 'success');
    } catch (err) {
      showAlert('Failed to save generated timetable: ' + err.message, 'error');
      throw err;
    }
  }, []);

  // Get merged timetable data (saved + pending)
  const getMergedTimetable = useCallback((sectionId) => {
    const saved = timetableData[sectionId] || {};
    const pending = pendingChanges[sectionId] || {};
    
    const merged = { ...saved };
    for (const day in pending) {
      merged[day] = { ...merged[day], ...pending[day] };
    }
    return merged;
  }, [timetableData, pendingChanges]);

  // Get teacher's timetable
  const getTeacherTimetable = useCallback((teacherId) => {
    const schedule = {};
    
    for (const day of DAYS) {
      schedule[day] = {};
      for (const period of PERIODS) {
        if (period === 'Lunch') continue;
        
        // Search through all sections
        for (const cls of classes) {
          for (const section of cls.sections) {
            const sectionData = getMergedTimetable(section.id);
            if (sectionData?.[day]?.[period]?.teacherId === teacherId) {
              const subjectId = sectionData[day][period].subjectId;
              const subject = subjects.find(s => s.id === subjectId);
              schedule[day][period] = {
                className: cls.name,
                sectionName: section.name,
                subjectName: subject?.name,
                sectionId: section.id
              };
            }
          }
        }
      }
    }
    return schedule;
  }, [classes, subjects, getMergedTimetable]);

  // Update from teacher timetable (with sync)
  const updateFromTeacherTimetable = useCallback((teacherId, day, period, newSectionId, subjectId, force = false) => {
    // First, find and remove the teacher from any existing slot at this day/period
    for (const cls of classes) {
      for (const section of cls.sections) {
        const sectionData = getMergedTimetable(section.id);
        if (sectionData?.[day]?.[period]?.teacherId === teacherId) {
          // Clear this slot
          clearPeriod(section.id, day, period);
        }
      }
    }

    // If newSectionId is provided, assign the new slot
    if (newSectionId && subjectId) {
      return assignPeriod(newSectionId, day, period, subjectId, teacherId, force);
    }
    return { success: true };
  }, [classes, getMergedTimetable, clearPeriod, assignPeriod]);

  // Show alert
  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  }, []);

  // Show confirmation dialog
  const showConfirmation = useCallback((message, onConfirm, onCancel) => {
    setConfirmDialog({ message, onConfirm, onCancel });
  }, []);

  // Close confirmation dialog
  const closeConfirmation = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  // Check if there are pending changes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const value = {
    // Loading state
    loading,
    error,
    
    // Data
    classes,
    teachers,
    subjects,
    teacherSubjectMap,
    timetableData,
    pendingChanges,
    hasPendingChanges,
    DAYS,
    PERIODS,
    
    // Class operations
    addClass,
    deleteClass,
    addSection,
    deleteSection,
    addSubjectToSection,
    removeSubjectFromSection,
    updateSection,
    updateClassOrder,
    updateSectionOrder,
    
    // Teacher operations
    addTeacher,
    updateTeacher,
    deleteTeacher,
    
    // Subject operations
    addSubject,
    deleteSubject,
    getSubjectColor,
    assignSubjectToClass,
    removeSubjectFromClass,
    updateSubjectClassPeriods,
    updateSectionSubjectPeriods,
    
    // Teacher Subject Map operations
    addTeacherSubjectMapping,
    removeTeacherSubjectMapping,
    
    // Timetable operations
    assignPeriod,
    clearPeriod,
    saveChanges,
    discardChanges,
    applyGeneratedTimetable,
    getMergedTimetable,
    getTeacherTimetable,
    updateFromTeacherTimetable,
    checkTeacherAvailability,
    
    // UI State
    alert,
    showAlert,
    confirmDialog,
    showConfirmation,
    closeConfirmation
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
}

export function useTimetable() {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within TimetableProvider');
  }
  return context;
}
