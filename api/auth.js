// api/auth.js — Athens Community Facility Tracker
import { kv } from '@vercel/kv';

// ─── FALLBACK USERS (always works even if KV is down) ────────────────────────
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const action = body.action || 'login';

  // Accept both username and email fields
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

    try {
      // Check if user already exists
      const existing = await kv.get(`user:${identifier}`);
      if (existing) return res.status(409).json({ error: 'Username already exists.' });

      // First user becomes admin
      const userCount = (await kv.get('userCount')) || 0;
      const role = userCount === 0 ? 'admin' : 'member';

      const newUser = {
        username: identifier,
        name,
        password,
        role,
        createdAt: new Date().toISOString(),
      };

      await kv.set(`user:${identifier}`, newUser);
      await kv.set('userCount', userCount + 1);

      console.log(`[Auth] Registered: ${identifier} (${role})`);
      return res.status(200).json({
        success: true,
        user: { username: identifier, name, role },
      });

    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────

  // 1️⃣ Check fallback users first (always works)
  const fallback = FALLBACK_USERS[identifier];
  if (fallback && fallback.password === password) {
    console.log(`[Auth] Fallback login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: fallback.name, role: fallback.role },
      source: 'fallback',
    });
  }

  // 2️⃣ Check KV users
  try {
    const userData = await kv.get(`user:${identifier}`);

    if (!userData) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    console.log(`[Auth] KV login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: user.name, role: user.role },
      source: 'kv',
    });

  } catch (err) {
    console.error('[Auth] KV login error:', err.message);
    // If KV fails and fallback didn't match
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
}
