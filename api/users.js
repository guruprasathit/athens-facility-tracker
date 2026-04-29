// api/users.js — Athens Community Facility Tracker
import { get, set, del } from './_storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const users = (await get('users')) || [];
      const safeUsers = users.map(({ password, ...rest }) => rest);
      return res.status(200).json(safeUsers);
    }

    if (req.method === 'POST') {
      const { users } = req.body || {};
      if (!Array.isArray(users)) return res.status(400).json({ error: 'users must be an array' });
      await set('users', users);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const username = req.query?.username;
      if (!username) return res.status(400).json({ error: 'username query param is required' });

      const users = (await get('users')) || [];
      const target = users.find(u => u.username === username);
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (target.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be removed' });

      await set('users', users.filter(u => u.username !== username));
      await del(`user:${username}`);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Users] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
