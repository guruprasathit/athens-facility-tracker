// api/images.js — Athens Community Facility Tracker
import { get, set, del } from './_storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/images?id=taskId — returns { images: [dataUrl|null, ...] } (5 slots)
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const [s0, s1, s2, s3, s4, old] = await Promise.all([
        get(`img:${id}:0`), get(`img:${id}:1`), get(`img:${id}:2`),
        get(`img:${id}:3`), get(`img:${id}:4`),
        get(`img:${id}`),
      ]);
      const images = [
        s0?.dataUrl || (!s1 && !s2 && old?.dataUrl ? old.dataUrl : null),
        s1?.dataUrl || null,
        s2?.dataUrl || null,
        s3?.dataUrl || null,
        s4?.dataUrl || null,
      ];
      return res.status(200).json({ images });
    }

    // POST /api/images  body: { taskId, index, dataUrl, name }
    if (req.method === 'POST') {
      const { taskId, index, dataUrl, name } = req.body || {};
      if (!taskId || !dataUrl || index == null) return res.status(400).json({ error: 'taskId, index and dataUrl required' });
      if (index < 0 || index > 4) return res.status(400).json({ error: 'index must be 0–4' });
      await set(`img:${taskId}:${index}`, { dataUrl, name: name || '' });
      return res.status(200).json({ success: true });
    }

    // DELETE /api/images?id=taskId[&index=N]
    if (req.method === 'DELETE') {
      const { id, index } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      if (index != null) {
        await del(`img:${id}:${index}`);
      } else {
        await Promise.all([
          del(`img:${id}:0`), del(`img:${id}:1`), del(`img:${id}:2`),
          del(`img:${id}:3`), del(`img:${id}:4`),
          del(`img:${id}`),
        ]);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Images] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
