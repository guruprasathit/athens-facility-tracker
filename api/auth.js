import { createHash } from 'crypto';

const hashPassword = (password) =>
  createHash('sha256').update(password + 'athens_community_salt_2025').digest('hex');

// Direct Upstash REST API — avoids @vercel/kv connection issues
const kvGet = async (key) => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Missing KV_REST_API_URL or KV_REST_API_TOKEN env vars');
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
};

const kvSet = async (key, value) => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
  return res.json();
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, name, password } = req.body;

  if (!action || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = hashPassword(password);

  try {
    const users = await kvGet('users') || [];

    if (action === 'register') {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const existing = users.find(u => u.email === normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
      }

      const newUser = {
        email: normalizedEmail,
        name: name.trim(),
        password: hashedPassword,
        role: users.length === 0 ? 'admin' : 'member',
        registeredAt: new Date().toISOString()
      };

      await kvSet('users', [...users, newUser]);

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

      const { password: _, ...safeUser } = existingUser;
      return res.status(200).json({ success: true, user: safeUser });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({
      error: error.message,
      env_check: {
        url_set: !!process.env.KV_REST_API_URL,
        token_set: !!process.env.KV_REST_API_TOKEN
      }
    });
  }
}
