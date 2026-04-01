// api/users.js — Athens Community Facility Tracker
// Uses raw fetch to Upstash REST API — no @vercel/kv dependency issues

let memoryUsers = []; // in-memory fallback when KV is down

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function isKVConfigured() {
  if (!KV_URL || !KV_TOKEN) return false;
  try { return !!new URL(KV_URL).hostname; } catch { return false; }
}

async function kvGet(key) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
    const data = await res.json();
    return data.result ?? null;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function kvSet(key, value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([JSON.stringify(value)]),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvAvailable = isKVConfigured();

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (kvAvailable) {
        try {
          const raw = await kvGet('users');
          const users = raw
            ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
            : [];
          memoryUsers = users;
          // Never expose passwords to client
          const safeUsers = users.map(({ password, ...rest }) => rest);
          return res.status(200).json(safeUsers);
        } catch (kvErr) {
          console.warn('[Users] KV GET failed, using memory fallback:', kvErr.message);
          const safeUsers = memoryUsers.map(({ password, ...rest }) => rest);
          return res.status(200).json(safeUsers);
        }
      }
      console.warn('[Users] KV not configured, using memory fallback');
      const safeUsers = memoryUsers.map(({ password, ...rest }) => rest);
      return res.status(200).json(safeUsers);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { users } = req.body || {};
      if (!Array.isArray(users)) {
        return res.status(400).json({ error: 'users must be an array' });
      }

      memoryUsers = users;

      if (kvAvailable) {
        try {
          await kvSet('users', users);
          return res.status(200).json({ success: true, source: 'kv' });
        } catch (kvErr) {
          console.warn('[Users] KV SET failed, saved to memory only:', kvErr.message);
          return res.status(200).json({
            success: true,
            source: 'memory',
            warning: 'KV unavailable — users saved in memory only',
          });
        }
      }

      return res.status(200).json({ success: true, source: 'memory' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Users] Unexpected error:', error);
    return res.status(500).json({ error: error.message });
  }
}
