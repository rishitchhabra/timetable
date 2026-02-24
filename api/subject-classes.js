import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // POST /api/subject-classes
  if (req.method === 'POST') {
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

    return res.status(201).json({ success: true, sectionIds });
  }

  // DELETE /api/subject-classes?subjectId=...&classId=...
  if (req.method === 'DELETE') {
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

    return res.json({ success: true, removedSectionIds: sectionIds });
  }

  // PUT /api/subject-classes
  if (req.method === 'PUT') {
    const { subjectId, classId, periodsPerWeek } = req.body;
    if (!subjectId || !classId) return res.status(400).json({ error: 'Missing subjectId or classId' });

    const { error } = await supabase.from('subject_classes')
      .update({ periods_per_week: periodsPerWeek || 0 })
      .eq('subject_id', subjectId)
      .eq('class_id', classId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
