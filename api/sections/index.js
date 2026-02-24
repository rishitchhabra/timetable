import supabase from '../_lib/supabase.js';
import { handleCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/sections
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('sections')
      .select('id, class_id, name, display_order')
      .order('display_order')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map(s => ({
      id: s.id,
      classId: s.class_id,
      name: s.name,
      displayOrder: s.display_order || 0,
    })));
  }

  // POST /api/sections
  if (req.method === 'POST') {
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

    return res.status(201).json({ id: data.id, name: data.name, subjects: autoSubjects });
  }

  // PUT /api/sections
  if (req.method === 'PUT') {
    const { id, name } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing section id' });

    const updates = {};
    if (name !== undefined) updates.name = name;

    const { error } = await supabase.from('sections').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  // DELETE /api/sections?id=...
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing section id' });

    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
