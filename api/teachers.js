import supabase from './_lib/supabase.js';
import { handleCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/teachers
  if (req.method === 'GET') {
    const { data: teachers, error } = await supabase
      .from('teachers')
      .select('id, teacher_code, name')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });

    return res.json(
      teachers.map(t => ({
        id: t.id,
        teacherCode: t.teacher_code,
        name: t.name,
      }))
    );
  }

  // POST /api/teachers
  if (req.method === 'POST') {
    const { id, name, teacherCode } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'Missing required fields: id, name' });

    const { error } = await supabase.from('teachers').insert({
      id,
      name,
      teacher_code: teacherCode || null,
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ id, name, teacherCode: teacherCode || null });
  }

  // PUT /api/teachers
  if (req.method === 'PUT') {
    const { id, name, teacherCode } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing teacher id' });

    const { error } = await supabase
      .from('teachers')
      .update({ name, teacher_code: teacherCode || null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  // DELETE /api/teachers?id=...
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing teacher id' });

    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
