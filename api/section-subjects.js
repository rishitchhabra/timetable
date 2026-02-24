import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // POST /api/section-subjects
  if (req.method === 'POST') {
    const { sectionId, subjectId } = req.body;
    if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

    const { error } = await supabase
      .from('section_subjects')
      .upsert({ section_id: sectionId, subject_id: subjectId }, { onConflict: 'section_id,subject_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true });
  }

  // DELETE /api/section-subjects?sectionId=...&subjectId=...
  if (req.method === 'DELETE') {
    const { sectionId, subjectId } = req.query;
    if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

    const { error } = await supabase
      .from('section_subjects')
      .delete()
      .eq('section_id', sectionId)
      .eq('subject_id', subjectId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  // PUT /api/section-subjects
  if (req.method === 'PUT') {
    const { sectionId, subjectId, periodsPerWeek } = req.body;
    if (!sectionId || !subjectId) return res.status(400).json({ error: 'Missing sectionId or subjectId' });

    const { error } = await supabase.from('section_subjects')
      .update({ periods_per_week: periodsPerWeek })
      .eq('section_id', sectionId)
      .eq('subject_id', subjectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
