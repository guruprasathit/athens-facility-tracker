// api/logs.js — Athens Community Facility Tracker
import { get, set } from './_storage.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json(get('logs') || []);
    }
    if (req.method === 'POST') {
      const { logs } = req.body || {};
      if (!Array.isArray(logs)) return res.status(400).json({ error: 'logs must be an array' });
      set('logs', logs);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Logs] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
