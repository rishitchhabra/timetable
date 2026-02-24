/**
 * API Service — talks to the Node.js Express backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}/${endpoint}`;
    const defaultOptions = { headers: { 'Content-Type': 'application/json' } };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(err.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // ─── Subjects ───────────────────────────────────────────

  getSubjects() {
    return this.request('subjects');
  }

  createSubject(subject) {
    return this.request('subjects', { method: 'POST', body: JSON.stringify(subject) });
  }

  deleteSubject(id) {
    return this.request(`subjects?id=${id}`, { method: 'DELETE' });
  }

  // ─── Subject Classes (assign subject to a class) ──────

  assignSubjectToClass(subjectId, classId, periodsPerWeek = 0) {
    return this.request('subject-classes', { method: 'POST', body: JSON.stringify({ subjectId, classId, periodsPerWeek }) });
  }

  removeSubjectFromClass(subjectId, classId) {
    return this.request(`subject-classes?subjectId=${subjectId}&classId=${classId}`, { method: 'DELETE' });
  }

  updateSubjectClassPeriods(subjectId, classId, periodsPerWeek) {
    return this.request('subject-classes', { method: 'PUT', body: JSON.stringify({ subjectId, classId, periodsPerWeek }) });
  }

  // ─── Section Subjects ──────────────────────────────────

  addSubjectToSection(sectionId, subjectId) {
    return this.request('section-subjects', { method: 'POST', body: JSON.stringify({ sectionId, subjectId }) });
  }

  removeSubjectFromSection(sectionId, subjectId) {
    return this.request(`section-subjects?sectionId=${sectionId}&subjectId=${subjectId}`, { method: 'DELETE' });
  }

  updateSectionSubjectPeriods(sectionId, subjectId, periodsPerWeek) {
    return this.request('section-subjects', { method: 'PUT', body: JSON.stringify({ sectionId, subjectId, periodsPerWeek }) });
  }

  // ─── Teacher Subject Map ───────────────────────────────

  getTeacherSubjectMap() {
    return this.request('teacher-subject-map');
  }

  addTeacherSubjectMapping(teacherId, subjectId, classId, sectionId = null) {
    return this.request('teacher-subject-map', { method: 'POST', body: JSON.stringify({ teacherId, subjectId, classId, sectionId }) });
  }

  removeTeacherSubjectMapping(teacherId, subjectId, classId, sectionId = null) {
    let url = `teacher-subject-map?teacherId=${teacherId}&subjectId=${subjectId}&classId=${classId}`;
    if (sectionId) url += `&sectionId=${sectionId}`;
    return this.request(url, { method: 'DELETE' });
  }

  // ─── Teachers ───────────────────────────────────────────

  getTeachers() {
    return this.request('teachers');
  }

  createTeacher(teacher) {
    return this.request('teachers', { method: 'POST', body: JSON.stringify(teacher) });
  }

  updateTeacher(teacher) {
    return this.request('teachers', { method: 'PUT', body: JSON.stringify(teacher) });
  }

  deleteTeacher(id) {
    return this.request(`teachers?id=${id}`, { method: 'DELETE' });
  }

  // ─── Classes ────────────────────────────────────────────

  getClasses() {
    return this.request('classes');
  }

  createClass(classData) {
    return this.request('classes', { method: 'POST', body: JSON.stringify(classData) });
  }

  deleteClass(id) {
    return this.request(`classes?id=${id}`, { method: 'DELETE' });
  }

  // ─── Sections ───────────────────────────────────────────

  getSections() {
    return this.request('sections');
  }

  createSection(section) {
    return this.request('sections', { method: 'POST', body: JSON.stringify(section) });
  }

  updateSection(section) {
    return this.request('sections', { method: 'PUT', body: JSON.stringify(section) });
  }

  deleteSection(id) {
    return this.request(`sections?id=${id}`, { method: 'DELETE' });
  }

  // ─── Reorder ────────────────────────────────────────────

  updateClassOrder(orderedIds) {
    return this.request('classes/order', { method: 'PUT', body: JSON.stringify({ orderedIds }) });
  }

  updateSectionOrder(orderedIds) {
    return this.request('sections/order', { method: 'PUT', body: JSON.stringify({ orderedIds }) });
  }

  // ─── Timetable ─────────────────────────────────────────

  getTimetable() {
    return this.request('timetable');
  }

  saveTimetableEntry(entry) {
    return this.request('timetable', { method: 'POST', body: JSON.stringify(entry) });
  }

  saveTimetableEntries(entries) {
    return this.request('timetable', { method: 'PUT', body: JSON.stringify({ entries }) });
  }

  deleteTimetableEntry(sectionId, day, period) {
    return this.request(`timetable?sectionId=${sectionId}&day=${day}&period=${period}`, { method: 'DELETE' });
  }

  clearSectionTimetable(sectionId) {
    return this.request(`timetable?sectionId=${sectionId}`, { method: 'DELETE' });
  }

  // ─── Availability ──────────────────────────────────────

  checkTeacherAvailability(teacherId, day, period, excludeSectionId = null) {
    let url = `check-availability?teacherId=${teacherId}&day=${day}&period=${period}`;
    if (excludeSectionId) url += `&excludeSectionId=${excludeSectionId}`;
    return this.request(url);
  }
}

export const apiService = new ApiService();
export default apiService;
