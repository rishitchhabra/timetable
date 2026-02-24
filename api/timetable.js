import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/timetable
  if (req.method === 'GET') {
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

    return res.json(timetable);
  }

  // POST /api/timetable
  if (req.method === 'POST') {
    const { sectionId, day, period, subjectId, teacherId } = req.body;
    if (!sectionId || !day || !period) return res.status(400).json({ error: 'Missing required fields: sectionId, day, period' });

    const { error } = await supabase.from('timetable_entries').upsert(
      { section_id: sectionId, day, period: String(period), subject_id: subjectId || null, teacher_id: teacherId || null },
      { onConflict: 'section_id,day,period' }
    );

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true });
  }

  // PUT /api/timetable (bulk upsert)
  if (req.method === 'PUT') {
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
    return res.json({ success: true });
  }

  // DELETE /api/timetable?sectionId=...&day=...&period=...
  if (req.method === 'DELETE') {
    const { sectionId, day, period } = req.query;
    if (!sectionId) return res.status(400).json({ error: 'Missing sectionId' });

    let query = supabase.from('timetable_entries').delete().eq('section_id', sectionId);
    if (day) query = query.eq('day', day);
    if (period) query = query.eq('period', period);

    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
