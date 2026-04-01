// api/auth.js — Robust Vercel KV Auth with retry + fallback
// Athens Community Facility Tracker — CAAOA

// ─── KV CONFIG VALIDATION ────────────────────────────────────────────────────
const KV_URL        = process.env.KV_REST_API_URL;
const KV_TOKEN      = process.env.KV_REST_API_TOKEN;
const KV_READ_ONLY  = process.env.KV_REST_API_READ_ONLY_TOKEN;

function validateKVConfig() {
  const missing = [];
  if (!KV_URL)    missing.push("KV_REST_API_URL");
  if (!KV_TOKEN)  missing.push("KV_REST_API_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Missing Vercel KV environment variables: ${missing.join(", ")}. ` +
      `Check your Vercel dashboard → Settings → Environment Variables.`
    );
  }
  // Validate URL format
  try {
    const url = new URL(KV_URL);
    if (!url.hostname) throw new Error("Empty hostname");
  } catch {
    throw new Error(
      `KV_REST_API_URL is malformed: "${KV_URL}". ` +
      `Expected format: https://<your-db>.upstash.io`
    );
  }
}

// ─── KV FETCH WITH RETRY ─────────────────────────────────────────────────────
async function kvFetch(path, options = {}, retries = 3, delayMs = 300) {
  const url = `${KV_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${KV_TOKEN}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`KV HTTP ${res.status}: ${body}`);
      }
      return await res.json();

    } catch (err) {
      const isNetworkError =
        err.code === "ENOTFOUND" ||
        err.code === "ECONNREFUSED" ||
        err.code === "ECONNRESET" ||
        err.name === "AbortError" ||
        err.message?.includes("fetch failed");

      const isLastAttempt = attempt === retries;

      if (isNetworkError && !isLastAttempt) {
        console.warn(`[KV] Attempt ${attempt} failed (${err.code || err.name}), retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential backoff
        continue;
      }

      // Enrich error message for ENOTFOUND
      if (err.cause?.code === "ENOTFOUND" || err.code === "ENOTFOUND") {
        throw new Error(
          `Cannot reach Upstash KV host "${err.cause?.hostname || KV_URL}". ` +
          `Check: 1) KV_REST_API_URL env var is set correctly in Vercel, ` +
          `2) The Upstash database is active, 3) No typo in the hostname.`
        );
      }

      throw err;
    }
  }
}

// ─── KV OPERATIONS ───────────────────────────────────────────────────────────
async function kvGet(key) {
  const data = await kvFetch(`/get/${encodeURIComponent(key)}`);
  return data.result ?? null;
}

async function kvSet(key, value) {
  const encoded = typeof value === "object" ? JSON.stringify(value) : value;
  return await kvFetch(`/set/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify([encoded]),
  });
}

// ─── IN-MEMORY FALLBACK USERS (when KV is unavailable) ───────────────────────
// Add your static users here as a safety net
const FALLBACK_USERS = {
  admin: {
    password: process.env.ADMIN_PASSWORD || "athens2024",
    role: "admin",
    name: "Admin",
  },
  // Add more fallback users if needed
};

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate KV config early ──
  try {
    validateKVConfig();
  } catch (configErr) {
    console.error("[Auth] KV config error:", configErr.message);
    // Don't expose config details to client — use fallback
    return handleFallbackAuth(req, res, configErr.message);
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // ── Try KV auth ──
  try {
    const userKey = `user:${username.toLowerCase().trim()}`;
    const userData = await kvGet(userKey);

    if (!userData) {
      // Also check fallback users before rejecting
      return handleFallbackAuth(req, res, null, username, password);
    }

    const user = typeof userData === "string" ? JSON.parse(userData) : userData;

    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.status(200).json({
      success: true,
      user: { username, role: user.role, name: user.name },
      source: "kv",
    });

  } catch (kvErr) {
    console.error("[Auth] KV error:", kvErr.message);

    // Fallback to in-memory users if KV is down
    return handleFallbackAuth(req, res, kvErr.message, username, password);
  }
}

// ─── FALLBACK AUTH ────────────────────────────────────────────────────────────
function handleFallbackAuth(req, res, kvError = null, username, password) {
  // If no credentials, return config error (admin/deploy issue)
  if (!username || !password) {
    return res.status(503).json({
      error: "Authentication service unavailable",
      detail: process.env.NODE_ENV === "development" ? kvError : undefined,
      hint: "Check Vercel KV environment variables in your dashboard",
    });
  }

  const fallbackUser = FALLBACK_USERS[username?.toLowerCase()];

  if (fallbackUser && fallbackUser.password === password) {
    console.warn("[Auth] Using fallback auth for user:", username);
    return res.status(200).json({
      success: true,
      user: { username, role: fallbackUser.role, name: fallbackUser.name },
      source: "fallback",
      warning: "KV unavailable — using fallback credentials",
    });
  }

  // Log KV error for debugging but return generic auth error to client
  if (kvError) {
    console.error("[Auth] KV unavailable, fallback also failed. KV error:", kvError);
  }

  return res.status(401).json({ error: "Invalid credentials" });
}
