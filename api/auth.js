// api/auth.js — Robust Vercel KV Auth with retry + fallback
// Athens Community Facility Tracker — CAAOA

// ─── KV CONFIG ───────────────────────────────────────────────────────────────
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// ─── FALLBACK USERS (always works even if KV is down) ────────────────────────
// These are your guaranteed login accounts as a safety net
const FALLBACK_USERS = {
  admin: {
    password: process.env.ADMIN_PASSWORD || "athens2024",
    role: "admin",
    name: "Admin",
  },
  guruprasath: {
    password: process.env.GURU_PASSWORD || "athens2024",
    role: "admin",
    name: "Guruprasath",
  },
};

// ─── KV CONFIG VALIDATION ────────────────────────────────────────────────────
function isKVConfigured() {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const url = new URL(KV_URL);
    return !!url.hostname;
  } catch {
    return false;
  }
}

// ─── KV FETCH WITH RETRY ─────────────────────────────────────────────────────
async function kvFetch(path, options = {}, retries = 2, delayMs = 300) {
  const url = `${KV_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${KV_TOKEN}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`KV HTTP ${res.status}: ${body}`);
      }
      return await res.json();

    } catch (err) {
      const isNetworkErr =
        err.cause?.code === "ENOTFOUND" ||
        err.cause?.code === "ECONNREFUSED" ||
        err.cause?.code === "ECONNRESET" ||
        err.code === "ENOTFOUND" ||
        err.name === "AbortError" ||
        err.message?.includes("fetch failed");

      if (isNetworkErr && attempt < retries) {
        console.warn(`[KV] Attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function kvGet(key) {
  const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
  return data.result ?? null;
}

async function kvSet(key, value) {
  const encoded = typeof value === "object" ? JSON.stringify(value) : String(value);
  return await kvFetch(`/set/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify([encoded]),
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const action = body.action || "login";

  // ── Accept BOTH username and email fields ──
  // Handles old App.jsx (sends email) and new App.jsx (sends username)
  const rawIdentifier = (body.username || body.email || "").toLowerCase().trim();
  const password = (body.password || "").trim();
  const name = (body.name || "").trim();

  if (!rawIdentifier || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  // ── REGISTER flow ─────────────────────────────────────────────────────────
  if (action === "register") {
    if (!name) return res.status(400).json({ error: "Full name is required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    if (isKVConfigured()) {
      try {
        // Check if user already exists
        const existing = await kvGet(`user:${rawIdentifier}`);
        if (existing) return res.status(409).json({ error: "Username already exists." });

        // Check if this is the first user → make admin
        const userCountData = await kvGet("userCount").catch(() => null);
        const userCount = userCountData ? parseInt(userCountData) : 0;
        const role = userCount === 0 ? "admin" : "member";

        const newUser = { username: rawIdentifier, name, password, role, createdAt: new Date().toISOString() };
        await kvSet(`user:${rawIdentifier}`, newUser);
        await kvSet("userCount", String(userCount + 1));

        console.log(`[Auth] Registered user: ${rawIdentifier} (${role})`);
        return res.status(200).json({
          success: true,
          user: { username: rawIdentifier, name, role },
          source: "kv",
        });
      } catch (err) {
        console.error("[Auth] KV register error:", err.message);
        return res.status(503).json({ error: "Registration unavailable. Please try again." });
      }
    } else {
      return res.status(503).json({ error: "Registration unavailable — KV not configured." });
    }
  }

  // ── LOGIN flow ────────────────────────────────────────────────────────────

  // 1️⃣ Try fallback users FIRST (guaranteed to work even if KV is down)
  const fallbackUser = FALLBACK_USERS[rawIdentifier];
  if (fallbackUser && fallbackUser.password === password) {
    console.log(`[Auth] Fallback login: ${rawIdentifier}`);
    return res.status(200).json({
      success: true,
      user: { username: rawIdentifier, name: fallbackUser.name, role: fallbackUser.role },
      source: "fallback",
    });
  }

  // 2️⃣ Try KV if configured
  if (isKVConfigured()) {
    try {
      const userData = await kvGet(`user:${rawIdentifier}`);

      if (!userData) {
        // User not in KV and not in fallback
        return res.status(401).json({ error: "Invalid username or password." });
      }

      const user = typeof userData === "string" ? JSON.parse(userData) : userData;

      if (user.password !== password) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      console.log(`[Auth] KV login: ${rawIdentifier}`);
      return res.status(200).json({
        success: true,
        user: { username: rawIdentifier, name: user.name, role: user.role },
        source: "kv",
      });

    } catch (kvErr) {
      console.error("[Auth] KV error:", kvErr.message);
      // KV failed and fallback already didn't match
      return res.status(401).json({ error: "Invalid username or password." });
    }
  }

  // 3️⃣ KV not configured + not a fallback user
  return res.status(401).json({ error: "Invalid username or password." });
}
