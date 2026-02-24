import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/teacher-subject-map
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('teacher_subject_map')
      .select('*');

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(r => ({
      teacherId: r.teacher_id,
      subjectId: r.subject_id,
      classId: r.class_id,
      sectionId: r.section_id || null,
    })));
  }

  // POST /api/teacher-subject-map
  if (req.method === 'POST') {
    const { teacherId, subjectId, classId, sectionId } = req.body;
    if (!teacherId || !subjectId || !classId) return res.status(400).json({ error: 'Missing required fields' });

    const row = { teacher_id: teacherId, subject_id: subjectId, class_id: classId };
    if (sectionId) row.section_id = sectionId;

    const { error } = await supabase.from('teacher_subject_map')
      .upsert(row, { onConflict: sectionId ? 'teacher_id,subject_id,class_id,section_id' : undefined });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true });
  }

  // DELETE /api/teacher-subject-map?teacherId=...&subjectId=...&classId=...&sectionId=...
  if (req.method === 'DELETE') {
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
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
