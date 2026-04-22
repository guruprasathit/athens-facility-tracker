// api/tasks.js — Athens Community Facility Tracker
import { get, set, del } from './_storage.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json(get('tasks') || []);
    }
    if (req.method === 'POST') {
      const { tasks } = req.body || {};
      if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks must be an array' });
      set('tasks', tasks);
      return res.status(200).json({ success: true, count: tasks.length });
    }
    if (req.method === 'DELETE') {
      del('tasks');
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Tasks] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
