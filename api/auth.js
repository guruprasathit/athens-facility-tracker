import { kv } from '@vercel/kv';
import { createHash } from 'crypto';

// Simple SHA-256 hash (no bcrypt needed for this use case, avoids native module issues on Vercel)
const hashPassword = (password) =>
  createHash('sha256').update(password + 'athens_community_salt_2025').digest('hex');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, name, password } = req.body;

  if (!action || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = hashPassword(password);

  try {
    const users = await kv.get('users') || [];

    if (action === 'register') {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const existing = users.find(u => u.email === normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
      }

      // First ever user becomes admin
      const isFirstUser = users.length === 0;

      const newUser = {
        email: normalizedEmail,
        name: name.trim(),
        password: hashedPassword,
        role: isFirstUser ? 'admin' : 'member',
        registeredAt: new Date().toISOString()
      };

      await kv.set('users', [...users, newUser]);

      // Return safe user (no password)
      const { password: _, ...safeUser } = newUser;
      return res.status(200).json({ success: true, user: safeUser });
    }

    if (action === 'login') {
      const existingUser = users.find(u => u.email === normalizedEmail);

      if (!existingUser) {
        return res.status(401).json({ error: 'Email not found. Please register first.' });
      }

      if (existingUser.password !== hashedPassword) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      // Return safe user (no password)
      const { password: _, ...safeUser } = existingUser;
      return res.status(200).json({ success: true, user: safeUser });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
