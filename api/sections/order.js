import supabase from '../_lib/supabase.js';
import { handleCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // PUT /api/sections/order
  if (req.method === 'PUT') {
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
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
