// api/settings.js — App-wide settings storage
// GET  /api/settings → returns current settings
// POST /api/settings → saves settings (admin only)

import { get, set } from './_storage.js';

const DEFAULTS = { overdueAlertsEnabled: true };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const saved = (await get('settings')) || {};
    return res.status(200).json({ ...DEFAULTS, ...saved });
  }

  if (req.method === 'POST') {
    const saved = (await get('settings')) || {};
    const updated = { ...DEFAULTS, ...saved, ...req.body };
    await set('settings', updated);
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
