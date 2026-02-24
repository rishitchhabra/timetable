import { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';

export default function ClassManager() {
  const { 
    classes, 
    subjects, 
    addClass, 
    deleteClass, 
    addSection, 
    deleteSection,
    addSubjectToSection,
    removeSubjectFromSection 
  } = useTimetable();

  const [newClassName, setNewClassName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedClassForSection, setSelectedClassForSection] = useState('');
  const [expandedClass, setExpandedClass] = useState(null);
  const [draggedSubject, setDraggedSubject] = useState(null);

  const handleAddClass = (e) => {
    e.preventDefault();
    if (newClassName.trim()) {
      addClass(newClassName.trim());
      setNewClassName('');
    }
  };

  const handleAddSection = (e) => {
    e.preventDefault();
    if (newSectionName.trim() && selectedClassForSection) {
      addSection(selectedClassForSection, newSectionName.trim());
      setNewSectionName('');
    }
  };

  const handleDragStart = (e, subject) => {
    setDraggedSubject(subject);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e, classId, sectionId) => {
    e.preventDefault();
    if (draggedSubject) {
      addSubjectToSection(classId, sectionId, draggedSubject.id);
      setDraggedSubject(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Class Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add New Class */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Add New Class</h3>
          <form onSubmit={handleAddClass} className="space-y-3">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g., Class 10"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add Class
            </button>
          </form>
        </div>

        {/* Add Section to Class */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Add Section</h3>
          <form onSubmit={handleAddSection} className="space-y-3">
            <select
              value={selectedClassForSection}
              onChange={(e) => setSelectedClassForSection(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="">Select Class</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="e.g., A, B, C"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Add Section
            </button>
          </form>
        </div>

        {/* Available Subjects (Drag Source) */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Available Subjects</h3>
          <p className="text-sm text-slate-500 mb-3">Drag subjects to assign to sections</p>
          <div className="space-y-2">
            {subjects.map(subject => (
              <div
                key={subject.id}
                draggable
                onDragStart={(e) => handleDragStart(e, subject)}
                className="px-4 py-2 rounded-lg cursor-move border-l-4 bg-orange-100 border-orange-500 hover:shadow-md transition-shadow"
              >
                📚 {subject.name}
              </div>
            ))}
            {subjects.length === 0 && (
              <p className="text-slate-400 text-sm">No subjects added yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Classes List */}
      <div className="mt-8">
        <h3 className="font-semibold text-slate-700 mb-4">All Classes</h3>
        <div className="space-y-4">
          {classes.map(cls => (
            <div key={cls.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100"
                onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{expandedClass === cls.id ? '📂' : '📁'}</span>
                  <div>
                    <h4 className="font-semibold text-slate-800">{cls.name}</h4>
                    <p className="text-sm text-slate-500">{cls.sections.length} section(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteClass(cls.id); }}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                  <span className="text-slate-400">{expandedClass === cls.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedClass === cls.id && (
                <div className="p-4 border-t">
                  {cls.sections.length === 0 ? (
                    <p className="text-slate-400 text-sm">No sections added yet</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cls.sections.map(section => (
                        <div
                          key={section.id}
                          className="border rounded-lg p-4 bg-slate-50"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, cls.id, section.id)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-slate-700">Section {section.name}</h5>
                            <button
                              onClick={() => deleteSection(cls.id, section.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                          
                          {/* Assigned Subjects */}
                          <div className="space-y-1">
                            <p className="text-xs text-slate-500 mb-2">Subjects:</p>
                            {section.subjects.length === 0 ? (
                              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center text-slate-400 text-sm">
                                Drop subjects here
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {section.subjects.map(subId => {
                                  const subject = subjects.find(s => s.id === subId);
                                  return subject ? (
                                    <div key={subId} className="px-3 py-1.5 rounded flex items-center justify-between bg-orange-100 border-l-4 border-orange-500">
                                      <span className="text-sm">{subject.name}</span>
                                      <button
                                        onClick={() => removeSubjectFromSection(cls.id, section.id, subId)}
                                        className="text-slate-500 hover:text-red-500"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {classes.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <p className="text-slate-400">No classes added yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
