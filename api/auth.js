// api/auth.js — Athens Community Facility Tracker
import { kv } from '@vercel/kv';

const FALLBACK_USERS = {
  admin: {
    password: process.env.ADMIN_PASSWORD || 'athens2024',
    role: 'admin',
    name: 'Admin',
  },
  guruprasath: {
    password: process.env.GURU_PASSWORD || 'athens2024',
    role: 'admin',
    name: 'Guruprasath',
  },
};

function isKvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function isNetworkError(err) {
  return (
    err.message?.includes('fetch failed') ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ECONNRESET'
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const action = body.action || 'login';
  const identifier = (body.username || body.email || '').toLowerCase().trim();
  const password = (body.password || '').trim();
  const name = (body.name || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (action === 'register') {
    if (!name) return res.status(400).json({ error: 'Full name is required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    if (!isKvConfigured()) {
      console.error('[Auth] Register failed: KV_REST_API_URL or KV_REST_API_TOKEN not set.');
      return res.status(503).json({
        error: 'Registration is unavailable: storage not configured. Please contact the admin.',
      });
    }

    try {
      const existing = await kv.get(`user:${identifier}`);
      if (existing) return res.status(409).json({ error: 'Username already exists.' });

      const userCount = (await kv.get('userCount')) || 0;
      const role = userCount === 0 ? 'admin' : 'member';

      const newUser = { username: identifier, name, password, role, createdAt: new Date().toISOString() };
      await kv.set(`user:${identifier}`, newUser);
      await kv.set('userCount', userCount + 1);

      console.log(`[Auth] Registered: ${identifier} (${role})`);
      return res.status(200).json({ success: true, user: { username: identifier, name, role } });
    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      const msg = isNetworkError(err)
        ? 'Cannot reach storage service. Verify KV_REST_API_URL and KV_REST_API_TOKEN are set in Vercel.'
        : 'Registration failed. Please try again.';
      return res.status(500).json({ error: msg });
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────

  // 1. Check fallback users first (always works, even without KV)
  const fallback = FALLBACK_USERS[identifier];
  if (fallback && fallback.password === password) {
    console.log(`[Auth] Fallback login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: fallback.name, role: fallback.role },
      source: 'fallback',
    });
  }

  // 2. Check KV users
  if (!isKvConfigured()) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  try {
    const userData = await kv.get(`user:${identifier}`);
    if (!userData) return res.status(401).json({ error: 'Invalid username or password.' });

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
    if (user.password !== password) return res.status(401).json({ error: 'Invalid username or password.' });

    console.log(`[Auth] KV login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: user.name, role: user.role },
      source: 'kv',
    });
  } catch (err) {
    console.error('[Auth] KV login error:', err.message);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
}
