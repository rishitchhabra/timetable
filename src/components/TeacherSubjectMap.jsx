import { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function TeacherSubjectMap() {
  const {
    teachers,
    subjects,
    classes,
    teacherSubjectMap,
    addTeacherSubjectMapping,
    removeTeacherSubjectMapping,
    showAlert
  } = useTimetable();

  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Sort classes in ascending order
  const sortedClasses = [...classes].sort((a, b) => {
    const extractNumber = (name) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    return extractNumber(a.name) - extractNumber(b.name);
  });

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  // Get mappings for the selected teacher
  const teacherMappings = teacherSubjectMap.filter(m => m.teacherId === selectedTeacherId);

  // Group mappings by subject
  const mappingsBySubject = {};
  for (const m of teacherMappings) {
    if (!mappingsBySubject[m.subjectId]) mappingsBySubject[m.subjectId] = [];
    mappingsBySubject[m.subjectId].push(m.classId);
  }

  // Check if a specific mapping exists
  const hasMapping = (subjectId, classId) => {
    return teacherMappings.some(m => m.subjectId === subjectId && m.classId === classId);
  };

  const handleToggleMapping = async (subjectId, classId) => {
    try {
      if (hasMapping(subjectId, classId)) {
        await removeTeacherSubjectMapping(selectedTeacherId, subjectId, classId);
      } else {
        await addTeacherSubjectMapping(selectedTeacherId, subjectId, classId);
      }
    } catch (err) { /* already handled */ }
  };

  // Get summary text for a teacher
  const getTeacherSummary = (teacherId) => {
    const count = teacherSubjectMap.filter(m => m.teacherId === teacherId).length;
    return `${count} mapping${count !== 1 ? 's' : ''}`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Teacher Subject Map</h2>
      <p className="text-slate-500 mb-6">Specify which teacher can teach which subject in which class (not batch-specific)</p>

      {/* Teacher Selector */}
      <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Teacher</label>
        <div className="flex flex-wrap gap-2">
          {teachers.map(teacher => (
            <button
              key={teacher.id}
              onClick={() => setSelectedTeacherId(teacher.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTeacherId === teacher.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {teacher.name}
              <span className="ml-1.5 text-xs opacity-75">({getTeacherSummary(teacher.id)})</span>
            </button>
          ))}
        </div>
        {teachers.length === 0 && (
          <p className="text-slate-400 text-sm">No teachers added yet. Go to Teachers tab to add some.</p>
        )}
      </div>

      {selectedTeacherId && selectedTeacher && (
        <>
          {/* Teacher Info */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
              👨‍🏫
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">{selectedTeacher.name}</h3>
              {selectedTeacher.teacherCode && (
                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono text-xs">
                  {selectedTeacher.teacherCode}
                </span>
              )}
            </div>
          </div>

          {/* Subject-Class Matrix */}
          {subjects.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-slate-400">
              No subjects exist yet. Go to Add Subject to create some.
            </div>
          ) : sortedClasses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-slate-400">
              No classes created yet. Go to Classes tab to add some.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 bg-slate-50 border-b">
                <h3 className="font-semibold text-slate-700">
                  Subject × Class Mapping
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Check the boxes where {selectedTeacher.name} can teach the subject in that class
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10">
                        Subject
                      </th>
                      {sortedClasses.map(cls => (
                        <th key={cls.id} className="px-3 py-3 text-center text-sm font-semibold text-slate-600 min-w-[80px]">
                          {cls.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {subjects.map(subject => (
                      <tr key={subject.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white z-10">
                          {subject.name}
                        </td>
                        {sortedClasses.map(cls => {
                          const mapped = hasMapping(subject.id, cls.id);
                          const subjectInClass = (subject.classIds || []).includes(cls.id);
                          
                          return (
                            <td key={cls.id} className="px-3 py-3 text-center">
                              {subjectInClass ? (
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={mapped}
                                    onChange={() => handleToggleMapping(subject.id, cls.id)}
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </label>
                              ) : (
                                <span className="text-slate-300 text-xs" title="Subject not assigned to this class">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 border-t text-xs text-slate-500">
                💡 Only subjects mapped to a class (via Class Subject Map) can be checked. "—" means the subject is not assigned to that class.
              </div>
            </div>
          )}

          {/* Current Mappings Summary */}
          {teacherMappings.length > 0 && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-slate-700 mb-3">
                Current Mappings ({teacherMappings.length})
              </h3>
              <div className="space-y-2">
                {Object.entries(mappingsBySubject).map(([subjectId, classIds]) => {
                  const subject = subjects.find(s => s.id === subjectId);
                  const classNames = classIds.map(cid => classes.find(c => c.id === cid)?.name || cid);
                  
                  return (
                    <div key={subjectId} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <span className="font-medium text-slate-700">{subject?.name || subjectId}</span>
                      <span className="text-slate-400">→</span>
                      <div className="flex flex-wrap gap-1">
                        {classNames.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
