// api/logs.js — Athens Community Facility Tracker
// Uses raw fetch to Upstash REST API — no @vercel/kv dependency issues

let memoryLogs = []; // in-memory fallback when KV is down

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
          const raw = await kvGet('logs');
          const logs = raw
            ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
            : [];
          memoryLogs = logs;
          return res.status(200).json(logs);
        } catch (kvErr) {
          console.warn('[Logs] KV GET failed, using memory fallback:', kvErr.message);
          return res.status(200).json(memoryLogs);
        }
      }
      console.warn('[Logs] KV not configured, using memory fallback');
      return res.status(200).json(memoryLogs);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { logs } = req.body || {};
      if (!Array.isArray(logs)) {
        return res.status(400).json({ error: 'logs must be an array' });
      }

      memoryLogs = logs;

      if (kvAvailable) {
        try {
          await kvSet('logs', logs);
          return res.status(200).json({ success: true, source: 'kv' });
        } catch (kvErr) {
          console.warn('[Logs] KV SET failed, saved to memory only:', kvErr.message);
          return res.status(200).json({
            success: true,
            source: 'memory',
            warning: 'KV unavailable — logs saved in memory only',
          });
        }
      }

      return res.status(200).json({ success: true, source: 'memory' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Logs] Unexpected error:', error);
    return res.status(500).json({ error: error.message });
  }
}
