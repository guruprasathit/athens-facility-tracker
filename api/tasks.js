// api/tasks.js — Athens Community Facility Tracker

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function isKVConfigured() {
  if (!KV_URL || !KV_TOKEN) return false;
  try { return !!new URL(KV_URL).hostname; } catch { return false; }
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.result === null || data.result === undefined) return null;
  if (typeof data.result === 'string') {
    try { return JSON.parse(data.result); } catch { return data.result; }
  }
  return data.result;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([JSON.stringify(value)]),
  });
  if (!res.ok) throw new Error(`KV SET ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function kvDel(key) {
  const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV DEL ${res.status}: ${await res.text()}`);
  return await res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── DEBUG: visit /api/tasks?debug=1 in browser to check KV config ──────
  if (req.method === 'GET' && req.query?.debug === '1') {
    return res.status(200).json({
      kvConfigured: isKVConfigured(),
      kvUrl: KV_URL ? KV_URL.substring(0, 35) + '...' : 'NOT SET',
      kvToken: KV_TOKEN ? KV_TOKEN.substring(0, 10) + '...' : 'NOT SET',
    });
  }

  try {
    // ── GET ──────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (!isKVConfigured()) {
        console.error('[Tasks] KV_REST_API_URL or KV_REST_API_TOKEN not set');
        return res.status(200).json([]);
      }
      try {
        const tasks = await kvGet('tasks');
        console.log(`[Tasks] GET → ${tasks?.length ?? 0} tasks`);
        return res.status(200).json(tasks || []);
      } catch (err) {
        console.error('[Tasks] KV GET error:', err.message);
        return res.status(200).json([]);
      }
    }

    // ── POST ─────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { tasks } = req.body || {};
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'tasks must be an array' });
      }
      if (!isKVConfigured()) {
        console.error('[Tasks] KV not configured — cannot persist tasks');
        return res.status(503).json({
          error: 'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel',
        });
      }
      try {
        const result = await kvSet('tasks', tasks);
        console.log(`[Tasks] SET → saved ${tasks.length} tasks`, result);
        return res.status(200).json({ success: true, count: tasks.length });
      } catch (err) {
        console.error('[Tasks] KV SET error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // ── DELETE ───────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!isKVConfigured()) {
        return res.status(503).json({ error: 'KV not configured' });
      }
      try {
        await kvDel('tasks');
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('[Tasks] KV DEL error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Tasks] Unexpected error:', error);
    return res.status(500).json({ error: error.message });
  }
}
