import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/check-availability?teacherId=...&day=...&period=...&excludeSectionId=...
  if (req.method === 'GET') {
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

    return res.json({ available: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
