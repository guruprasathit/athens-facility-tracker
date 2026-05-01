import { get, set, del } from './_storage.js';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });

    const data = await get(`share:${token}`);
    if (!data) return res.status(404).json({ valid: false, error: 'Invalid or expired link' });

    return res.json({ valid: true });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    if (body.action === 'revoke') {
      if (!body.token) return res.status(400).json({ error: 'token required' });
      await del(`share:${body.token}`);
      const list = (await get('share:list') || []).filter(t => t.token !== body.token);
      await set('share:list', list);
      return res.json({ ok: true });
    }

    // Create new token
    const token = randomBytes(24).toString('hex');
    const createdAt = new Date().toISOString();
    await set(`share:${token}`, { createdAt });

    const list = await get('share:list') || [];
    list.push({ token, createdAt });
    await set('share:list', list);

    return res.json({ token });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
