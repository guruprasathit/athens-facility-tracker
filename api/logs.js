// api/logs.js — Athens Community Facility Tracker
import { kv } from '@vercel/kv';

function isKvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isKvConfigured()) {
    console.error('[Logs] KV_REST_API_URL or KV_REST_API_TOKEN not set.');
    if (req.method === 'GET') return res.status(200).json([]);
    if (req.method === 'POST') return res.status(200).json({ success: true, warning: 'KV not configured — logs not persisted.' });
  }

  try {
    if (req.method === 'GET') {
      const logs = await kv.get('logs') || [];
      return res.status(200).json(logs);
    }
    if (req.method === 'POST') {
      const { logs } = req.body || {};
      if (!Array.isArray(logs)) return res.status(400).json({ error: 'logs must be an array' });
      await kv.set('logs', logs);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Logs] Error:', error.message);
    if (req.method === 'GET') return res.status(200).json([]);
    return res.status(500).json({ error: error.message });
  }
}
