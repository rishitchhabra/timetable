import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Dynamic import so dotenv is loaded before supabase reads process.env
const { default: supabase } = await import('./supabase.js');

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Subjects ─────────────────────────────────────────────

app.get('/api/subjects', async (req, res) => {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  const subjectIds = data.map(s => s.id);
  let classAssignments = {};
  let classPeriods = {};
  let sectionAssignments = {};
  let sectionPeriods = {};

  if (subjectIds.length > 0) {
    const { data: sc, error: scErr } = await supabase
      .from('subject_classes')
      .select('subject_id, class_id, periods_per_week')
      .in('subject_id', subjectIds);
    if (!scErr) {
      for (const row of sc || []) {
        if (!classAssignments[row.subject_id]) classAssignments[row.subject_id] = [];
        classAssignments[row.subject_id].push(row.class_id);
        if (!classPeriods[row.subject_id]) classPeriods[row.subject_id] = {};
        classPeriods[row.subject_id][row.class_id] = row.periods_per_week || 0;
      }
    }

    const { data: ss, error: ssErr } = await supabase
      .from('section_subjects')
      .select('section_id, subject_id, periods_per_week')
      .in('subject_id', subjectIds);
    if (!ssErr) {
      for (const row of ss || []) {
        if (!sectionAssignments[row.subject_id]) sectionAssignments[row.subject_id] = [];
        sectionAssignments[row.subject_id].push(row.section_id);
        if (!sectionPeriods[row.subject_id]) sectionPeriods[row.subject_id] = {};
        sectionPeriods[row.subject_id][row.section_id] = row.periods_per_week;
      }
    }
  }

  res.json(data.map(s => ({
    id: s.id,
    name: s.name,
    classIds: classAssignments[s.id] || [],
    sectionIds: sectionAssignments[s.id] || [],
    classPeriods: classPeriods[s.id] || {},
    sectionPeriods: sectionPeriods[s.id] || {},
  })));
});

app.post('/api/subjects', async (req, res) => {
  const { id, name, classIds } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Missing required fields: id, name' });

  const { error } = await supabase.from('subjects').insert({ id, name });
  if (error) return res.status(500).json({ error: error.message });

  let resultSectionIds = [];

  if (classIds?.length) {
    const scRows = classIds.map(cid => ({ subject_id: id, class_id: cid }));
    const { error: scErr } = await supabase.from('subject_classes').insert(scRows);
    if (scErr) return res.status(500).json({ error: scErr.message });

    const { data: sections, error: secErr } = await supabase
      .from('sections')
      .select('id')
      .in('class_id', classIds);
    if (secErr) return res.status(500).json({ error: secErr.message });

    if (sections?.length) {
      resultSectionIds = sections.map(s => s.id);
      const ssRows = resultSectionIds.map(sid => ({ section_id: sid, subject_id: id }));
      const { error: ssErr } = await supabase.from('section_subjects').insert(ssRows);
      if (ssErr) return res.status(500).json({ error: ssErr.message });
    }
  }

  res.status(201).json({ id, name, classIds: classIds || [], sectionIds: resultSectionIds });
});

app.delete('/api/subjects', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing subject id' });

  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Teachers ─────────────────────────────────────────────

app.get('/api/teachers', async (req, res) => {
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, teacher_code, name')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  res.json(
    teachers.map(t => ({
      id: t.id,
      teacherCode: t.teacher_code,
      name: t.name,
    }))
  );
});

app.post('/api/teachers', async (req, res) => {
  const { id, name, teacherCode } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Missing required fields: id, name' });

  const { error } = await supabase.from('teachers').insert({
    id,
    name,
    teacher_code: teacherCode || null,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id, name, teacherCode: teacherCode || null });
});

app.put('/api/teachers', async (req, res) => {
  const { id, name, teacherCode } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing teacher id' });

  const { error } = await supabase
    .from('teachers')
    .update({ name, teacher_code: teacherCode || null })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/teachers', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing teacher id' });

  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Teacher Subject Map ──────────────────────────────────

app.get('/api/teacher-subject-map', async (req, res) => {
  const { data, error } = await supabase
    .from('teacher_subject_map')
    .select('*');

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(r => ({
    teacherId: r.teacher_id,
    subjectId: r.subject_id,
    classId: r.class_id,
    sectionId: r.section_id || null,
  })));
});

app.post('/api/teacher-subject-map', async (req, res) => {
  const { teacherId, subjectId, classId, sectionId } = req.body;
  if (!teacherId || !subjectId || !classId) return res.status(400).json({ error: 'Missing required fields' });

  const row = { teacher_id: teacherId, subject_id: subjectId, class_id: classId };
  if (sectionId) row.section_id = sectionId;

  const { error } = await supabase.from('teacher_subject_map')
    .upsert(row, { onConflict: sectionId ? 'teacher_id,subject_id,class_id,section_id' : undefined });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true });
});

app.delete('/api/teacher-subject-map', async (req, res) => {
  const { teacherId, subjectId, classId, sectionId } = req.query;
  if (!teacherId || !subjectId || !classId) return res.status(400).json({ error: 'Missing required fields' });

  let query = supabase.from('teacher_subject_map')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('class_id', classId);
  
  if (sectionId) {
    query = query.eq('section_id', sectionId);
  } else {
    query = query.is('section_id', null);
  }

  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Classes ──────────────────────────────────────────────

app.get('/api/classes', async (req, res) => {
  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, display_order')
    .order('display_order')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  const classIds = classes.map(c => c.id);
  let sectionsByClass = {};

  if (classIds.length > 0) {
    const { data: sections, error: secErr } = await supabase
      .from('sections')
      .select('id, class_id, name, display_order')
      .in('class_id', classIds)
      .order('display_order')
      .order('name');

    if (secErr) return res.status(500).json({ error: secErr.message });

    const sectionIds = (sections || []).map(s => s.id);
    let subjectsBySection = {};

    if (sectionIds.length > 0) {
      const { data: sectionSubjects, error: ssErr } = await supabase
        .from('section_subjects')
        .select('section_id, subject_id')
        .in('section_id', sectionIds);

      if (ssErr) return res.status(500).json({ error: ssErr.message });

      for (const ss of sectionSubjects || []) {
        if (!subjectsBySection[ss.section_id]) subjectsBySection[ss.section_id] = [];
        subjectsBySection[ss.section_id].push(ss.subject_id);
      }
    }

    for (const sec of sections || []) {
      if (!sectionsByClass[sec.class_id]) sectionsByClass[sec.class_id] = [];
      sectionsByClass[sec.class_id].push({
        id: sec.id,
        name: sec.name,
        displayOrder: sec.display_order || 0,
        subjects: subjectsBySection[sec.id] || [],
      });
    }
  }

  res.json(classes.map(cls => ({ id: cls.id, name: cls.name, displayOrder: cls.display_order || 0, sections: sectionsByClass[cls.id] || [] })));
});

app.post('/api/classes', async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Missing required fields: id, name' });

  // Get max display_order for new class
  const { data: maxRow } = await supabase
    .from('classes')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);
  const nextOrder = (maxRow?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase.from('classes').insert({ id, name, display_order: nextOrder }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id: data.id, name: data.name, displayOrder: data.display_order, sections: [] });
});

app.delete('/api/classes', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing class id' });

  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Sections ─────────────────────────────────────────────

app.get('/api/sections', async (req, res) => {
  const { data, error } = await supabase
    .from('sections')
    .select('id, class_id, name, display_order')
    .order('display_order')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(s => ({
    id: s.id,
    classId: s.class_id,
    name: s.name,
    displayOrder: s.display_order || 0,
  })));
});

app.post('/api/sections', async (req, res) => {
  const { id, classId, name } = req.body;
  if (!id || !classId || !name) return res.status(400).json({ error: 'Missing required fields: id, classId, name' });

  const { data, error } = await supabase
    .from('sections')
    .insert({ id, class_id: classId, name })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Auto-add subjects that are assigned to this class via subject_classes
  let autoSubjects = [];
  const { data: sc, error: scErr } = await supabase
    .from('subject_classes')
    .select('subject_id')
    .eq('class_id', classId);

  if (!scErr && sc?.length) {
    autoSubjects = sc.map(r => r.subject_id);
    const rows = autoSubjects.map(subjectId => ({ section_id: id, subject_id: subjectId }));
    await supabase.from('section_subjects').insert(rows);
  }

  res.status(201).json({ id: data.id, name: data.name, subjects: autoSubjects });
});

app.delete('/api/sections', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing section id' });

  const { error } = await supabase.from('sections').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/sections', async (req, res) => {
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing section id' });

  const updates = {};
  if (name !== undefined) updates.name = name;

  const { error } = await supabase.from('sections').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Reorder Classes ──────────────────────────────────────

app.put('/api/classes/order', async (req, res) => {
  const { orderedIds } = req.body;
  if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Missing orderedIds array' });

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('classes')
        .update({ display_order: i })
        .eq('id', orderedIds[i]);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reorder Sections (Batches) ───────────────────────────

app.put('/api/sections/order', async (req, res) => {
  const { orderedIds } = req.body;
  if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Missing orderedIds array' });

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('sections')
        .update({ display_order: i })
        .eq('id', orderedIds[i]);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Subject Classes (assign subject to a whole class) ────

app.post('/api/subject-classes', async (req, res) => {
  const { subjectId, classId, periodsPerWeek } = req.body;
  if (!subjectId || !classId) return res.status(400).json({ error: 'Missing subjectId or classId' });

  const { error } = await supabase
    .from('subject_classes')
    .upsert({ subject_id: subjectId, class_id: classId, periods_per_week: periodsPerWeek || 0 }, { onConflict: 'subject_id,class_id' });
  if (error) return res.status(500).json({ error: error.message });

  // Also add to all sections of this class
  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('id')
    .eq('class_id', classId);
  if (secErr) return res.status(500).json({ error: secErr.message });

  const sectionIds = (sections || []).map(s => s.id);
  if (sectionIds.length) {
    const rows = sectionIds.map(sid => ({ section_id: sid, subject_id: subjectId }));
    const { error: ssErr } = await supabase
      .from('section_subjects')
      .upsert(rows, { onConflict: 'section_id,subject_id' });
    if (ssErr) return res.status(500).json({ error: ssErr.message });
  }

  res.status(201).json({ success: true, sectionIds });
});

app.delete('/api/subject-classes', async (req, res) => {
  const { subjectId, classId } = req.query;
  if (!subjectId || !classId) return res.status(400).json({ error: 'Missing subjectId or classId' });

  const { error } = await supabase
    .from('subject_classes')
    .delete()
    .eq('subject_id', subjectId)
    .eq('class_id', classId);
  if (error) return res.status(500).json({ error: error.message });

  // Also remove from all sections of this class
  const { data: sections, error: secErr } = await supabase
    .from('sections')
    .select('id')
    .eq('class_id', classId);
  if (secErr) return res.status(500).json({ error: secErr.message });

  const sectionIds = (sections || []).map(s => s.id);
  if (sectionIds.length) {
    const { error: ssErr } = await supabase
      .from('section_subjects')
      .delete()
      .eq('subject_id', subjectId)
      .in('section_id', sectionIds);
    if (ssErr) return res.status(500).json({ error: ssErr.message });
  }

  res.json({ success: true, removedSectionIds: sectionIds });
});

app.put('/api/subject-classes', async (req, res) => {
  const { subjectId, classId, periodsPerWeek } = req.body;
  if (!subjectId || !classId) return res.status(400).json({ error: 'Missing subjectId or classId' });

  const { error } = await supabase.from('subject_classes')
    .update({ periods_per_week: periodsPerWeek || 0 })
    .eq('subject_id', subjectId)
    .eq('class_id', classId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Section Subjects ─────────────────────────────────────

app.post('/api/section-subjects', async (req, res) => {
  const { sectionId, subjectId } = req.body;
  if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

  const { error } = await supabase
    .from('section_subjects')
    .upsert({ section_id: sectionId, subject_id: subjectId }, { onConflict: 'section_id,subject_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true });
});

app.delete('/api/section-subjects', async (req, res) => {
  const { sectionId, subjectId } = req.query;
  if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

  const { error } = await supabase
    .from('section_subjects')
    .delete()
    .eq('section_id', sectionId)
    .eq('subject_id', subjectId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/section-subjects', async (req, res) => {
  const { sectionId, subjectId, periodsPerWeek } = req.body;
  if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

  const { error } = await supabase.from('section_subjects')
    .update({ periods_per_week: periodsPerWeek })
    .eq('section_id', sectionId)
    .eq('subject_id', subjectId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Timetable ────────────────────────────────────────────

app.get('/api/timetable', async (req, res) => {
  const { data: entries, error } = await supabase
    .from('timetable_entries')
    .select('section_id, day, period, subject_id, teacher_id');

  if (error) return res.status(500).json({ error: error.message });

  const timetable = {};
  for (const { section_id, day, period, subject_id, teacher_id } of entries || []) {
    if (!timetable[section_id]) timetable[section_id] = {};
    if (!timetable[section_id][day]) timetable[section_id][day] = {};
    timetable[section_id][day][period] = { subjectId: subject_id, teacherId: teacher_id };
  }

  res.json(timetable);
});

app.post('/api/timetable', async (req, res) => {
  const { sectionId, day, period, subjectId, teacherId } = req.body;
  if (!sectionId || !day || !period) return res.status(400).json({ error: 'Missing required fields: sectionId, day, period' });

  const { error } = await supabase.from('timetable_entries').upsert(
    { section_id: sectionId, day, period: String(period), subject_id: subjectId || null, teacher_id: teacherId || null },
    { onConflict: 'section_id,day,period' }
  );

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true });
});

app.put('/api/timetable', async (req, res) => {
  const { entries } = req.body;
  if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: 'Missing entries array' });

  const rows = entries.map(e => ({
    section_id: e.sectionId,
    day: e.day,
    period: String(e.period),
    subject_id: e.subjectId || null,
    teacher_id: e.teacherId || null,
  }));

  const { error } = await supabase.from('timetable_entries').upsert(rows, { onConflict: 'section_id,day,period' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/timetable', async (req, res) => {
  const { sectionId, day, period } = req.query;
  if (!sectionId) return res.status(400).json({ error: 'Missing sectionId' });

  // If day & period provided, delete single entry; otherwise clear entire section
  let query = supabase.from('timetable_entries').delete().eq('section_id', sectionId);
  if (day) query = query.eq('day', day);
  if (period) query = query.eq('period', period);

  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Check Availability ───────────────────────────────────

app.get('/api/check-availability', async (req, res) => {
  const { teacherId, day, period, excludeSectionId } = req.query;
  if (!teacherId || !day || !period) return res.status(400).json({ error: 'Missing required params: teacherId, day, period' });

  let query = supabase
    .from('timetable_entries')
    .select('section_id, sections!inner ( name, classes!inner ( name ) )')
    .eq('teacher_id', teacherId)
    .eq('day', day)
    .eq('period', period);

  if (excludeSectionId) query = query.neq('section_id', excludeSectionId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  if (data && data.length > 0) {
    const conflict = data[0];
    return res.json({
      available: false,
      conflictClass: conflict.sections?.classes?.name || 'Unknown',
      conflictSection: conflict.sections?.name || 'Unknown',
    });
  }

  res.json({ available: true });
});

// ─── Start ────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
