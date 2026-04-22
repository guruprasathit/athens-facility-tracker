// api/tasks.js — Athens Community Facility Tracker
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug endpoint
  if (req.method === 'GET' && req.query?.debug === '1') {
    return res.status(200).json({
      kvUrl: process.env.KV_REST_API_URL ? '✅ SET' : '❌ MISSING',
      kvToken: process.env.KV_REST_API_TOKEN ? '✅ SET' : '❌ MISSING',
      kvReadOnly: process.env.KV_REST_API_READ_ONLY_TOKEN ? '✅ SET' : '❌ MISSING',
    });
  }

  try {
    if (req.method === 'GET') {
      const tasks = await kv.get('tasks') || [];
      return res.status(200).json(tasks);
    }
    if (req.method === 'POST') {
      const { tasks } = req.body || {};
      if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks must be an array' });
      await kv.set('tasks', tasks);
      return res.status(200).json({ success: true, count: tasks.length });
    }
    if (req.method === 'DELETE') {
      await kv.del('tasks');
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Tasks] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
