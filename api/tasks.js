import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all tasks
      const tasks = await kv.get('tasks') || [];
      return res.status(200).json(tasks);
    }

    if (req.method === 'POST') {
      // Save tasks
      const { tasks } = req.body;
      await kv.set('tasks', tasks);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // Clear all tasks
      await kv.del('tasks');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}