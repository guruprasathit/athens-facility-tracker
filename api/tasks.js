// api/tasks.js — Athens Community Facility Tracker
// Robust: tries Vercel KV first, falls back to in-memory if KV is unreachable

let memoryTasks = []; // in-memory fallback when KV is down

// ─── KV HELPER (raw fetch — avoids @vercel/kv DNS issues) ────────────────────
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

async function kvDel(key) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`KV DEL failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvAvailable = isKVConfigured();

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (kvAvailable) {
        try {
          const raw = await kvGet('tasks');
          const tasks = raw
            ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
            : [];
          memoryTasks = tasks; // sync memory with KV
          return res.status(200).json(tasks);
        } catch (kvErr) {
          console.warn('[Tasks] KV GET failed, using memory fallback:', kvErr.message);
          return res.status(200).json(memoryTasks);
        }
      }
      // KV not configured — use memory
      console.warn('[Tasks] KV not configured, using memory fallback');
      return res.status(200).json(memoryTasks);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { tasks } = req.body || {};
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'tasks must be an array' });
      }

      memoryTasks = tasks; // always update memory

      if (kvAvailable) {
        try {
          await kvSet('tasks', tasks);
          return res.status(200).json({ success: true, source: 'kv' });
        } catch (kvErr) {
          console.warn('[Tasks] KV SET failed, saved to memory only:', kvErr.message);
          return res.status(200).json({
            success: true,
            source: 'memory',
            warning: 'KV unavailable — data saved in memory only (will reset on redeploy)',
          });
        }
      }

      return res.status(200).json({
        success: true,
        source: 'memory',
        warning: 'KV not configured — data saved in memory only',
      });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      memoryTasks = [];

      if (kvAvailable) {
        try {
          await kvDel('tasks');
          return res.status(200).json({ success: true, source: 'kv' });
        } catch (kvErr) {
          console.warn('[Tasks] KV DEL failed, cleared memory only:', kvErr.message);
          return res.status(200).json({
            success: true,
            source: 'memory',
            warning: 'KV unavailable — cleared memory only',
          });
        }
      }

      return res.status(200).json({ success: true, source: 'memory' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Tasks] Unexpected error:', error);
    return res.status(500).json({ error: error.message });
  }
}
