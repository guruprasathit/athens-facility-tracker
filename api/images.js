// api/images.js — Athens Community Facility Tracker
import { get, set, del } from './_storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const img = await get(`img:${id}`);
      return res.status(200).json({ image: img || null });
    }

    if (req.method === 'POST') {
      const { taskId, dataUrl, name } = req.body || {};
      if (!taskId || !dataUrl) return res.status(400).json({ error: 'taskId and dataUrl required' });
      await set(`img:${taskId}`, { dataUrl, name: name || '' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await del(`img:${id}`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Images] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
