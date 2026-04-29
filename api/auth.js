// api/auth.js — Athens Community Facility Tracker
import { get, set } from './_storage.js';

const FALLBACK_USERS = {
  admin: { password: process.env.ADMIN_PASSWORD || 'athens2024', role: 'admin', name: 'Admin' },
  guruprasath: { password: process.env.GURU_PASSWORD || 'athens2024', role: 'admin', name: 'Guruprasath' },
};

async function upsertUsersList(identifier, name, role, createdAt, lastSeen) {
  const usersList = (await get('users')) || [];
  const idx = usersList.findIndex(u => u.username === identifier);
  const entry = { username: identifier, name, role, createdAt: createdAt || new Date().toISOString(), lastSeen };
  if (idx >= 0) usersList[idx] = { ...usersList[idx], ...entry };
  else usersList.push(entry);
  await set('users', usersList);
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

  if (!identifier) return res.status(400).json({ error: 'Email is required.' });

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  if (action === 'reset-password') {
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    try {
      const userData = await get(`user:${identifier}`);
      if (!userData) return res.status(404).json({ error: 'Email not found.' });
      await set(`user:${identifier}`, { ...userData, password: newPassword });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[Auth] Reset error:', err.message);
      return res.status(500).json({ error: 'Password reset failed. Please try again.' });
    }
  }

  if (!password) return res.status(400).json({ error: 'Password is required.' });

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (action === 'register') {
    if (!name) return res.status(400).json({ error: 'Full name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    try {
      const existing = await get(`user:${identifier}`);
      if (existing) return res.status(409).json({ error: 'This email is already registered.' });

      const userCount = (await get('userCount')) || 0;
      const role = userCount === 0 ? 'admin' : 'member';
      const createdAt = new Date().toISOString();
      const newUser = { username: identifier, name, password, role, createdAt };

      await set(`user:${identifier}`, newUser);
      await set('userCount', userCount + 1);
      await upsertUsersList(identifier, name, role, createdAt, null);

      console.log(`[Auth] Registered: ${identifier} (${role})`);
      return res.status(200).json({ success: true, user: { username: identifier, name, role } });
    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────

  // 1. Check fallback users first (always works)
  const fallback = FALLBACK_USERS[identifier];
  if (fallback && fallback.password === password) {
    console.log(`[Auth] Fallback login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: fallback.name, role: fallback.role },
      source: 'fallback',
    });
  }

  // 2. Check stored users
  try {
    const userData = await get(`user:${identifier}`);
    if (!userData) return res.status(401).json({ error: 'Invalid email or password.' });
    if (userData.password !== password) return res.status(401).json({ error: 'Invalid email or password.' });

    const lastSeen = new Date().toISOString();
    await set(`user:${identifier}`, { ...userData, lastSeen });
    await upsertUsersList(identifier, userData.name, userData.role, userData.createdAt, lastSeen).catch(() => {});

    console.log(`[Auth] Login: ${identifier}`);
    return res.status(200).json({
      success: true,
      user: { username: identifier, name: userData.name, role: userData.role },
      source: 'kv',
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
}
