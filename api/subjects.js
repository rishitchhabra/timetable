import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/subjects
  if (req.method === 'GET') {
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

    return res.json(data.map(s => ({
      id: s.id,
      name: s.name,
      classIds: classAssignments[s.id] || [],
      sectionIds: sectionAssignments[s.id] || [],
      classPeriods: classPeriods[s.id] || {},
      sectionPeriods: sectionPeriods[s.id] || {},
    })));
  }

  // POST /api/subjects
  if (req.method === 'POST') {
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

    return res.status(201).json({ id, name, classIds: classIds || [], sectionIds: resultSectionIds });
  }

  // DELETE /api/subjects?id=...
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing subject id' });

    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
