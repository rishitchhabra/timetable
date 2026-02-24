import supabase from '../_lib/supabase.js';
import { handleCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // GET /api/classes
  if (req.method === 'GET') {
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

    return res.json(classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      displayOrder: cls.display_order || 0,
      sections: sectionsByClass[cls.id] || [],
    })));
  }

  // POST /api/classes
  if (req.method === 'POST') {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'Missing required fields: id, name' });

    const { data: maxRow } = await supabase
      .from('classes')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxRow?.[0]?.display_order ?? -1) + 1;

    const { data, error } = await supabase.from('classes').insert({ id, name, display_order: nextOrder }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ id: data.id, name: data.name, displayOrder: data.display_order, sections: [] });
  }

  // DELETE /api/classes?id=...
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing class id' });

    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
