// api/users.js — Athens Community Facility Tracker
import { get, set } from './_storage.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const users = get('users') || [];
      const safeUsers = users.map(({ password, ...rest }) => rest);
      return res.status(200).json(safeUsers);
    }
    if (req.method === 'POST') {
      const { users } = req.body || {};
      if (!Array.isArray(users)) return res.status(400).json({ error: 'users must be an array' });
      set('users', users);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Users] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
