// api/_storage.js — Athens Community Facility Tracker
// Uses Vercel KV when configured (persistent). If KV is unreachable,
// automatically falls back to file storage so the app stays functional.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// ── FILE STORAGE ─────────────────────────────────────────────────────────────
const DATA_DIR = process.env.VERCEL ? '/tmp/athens-data' : join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function fileGet(key) {
  const file = join(DATA_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}
function fileSet(key, value) {
  writeFileSync(join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}
function fileDel(key) {
  const file = join(DATA_DIR, `${key}.json`);
  if (existsSync(file)) { try { unlinkSync(file); } catch {} }
}

// ── KV STORAGE ───────────────────────────────────────────────────────────────
const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function kvGet(key) {
  const { kv } = await import('@vercel/kv');
  return await kv.get(key);
}
async function kvSet(key, value) {
  const { kv } = await import('@vercel/kv');
  return await kv.set(key, value);
}
async function kvDel(key) {
  const { kv } = await import('@vercel/kv');
  return await kv.del(key);
}

// ── RETRY HELPER ─────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, delayMs = 300) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retriable =
        err.message?.includes('fetch failed') ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET';
      if (retriable && attempt < retries) {
        console.warn(`[Storage] KV attempt ${attempt} failed (${err.message}), retrying in ${delayMs * attempt}ms…`);
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

// ── UNIFIED API (KV with file fallback) ──────────────────────────────────────
export async function get(key) {
  if (kvConfigured) {
    try {
      return await withRetry(() => kvGet(key));
    } catch (err) {
      console.error(`[Storage] KV unavailable for get("${key}"), using file fallback. Error: ${err.message}`);
      return fileGet(key);
    }
  }
  return fileGet(key);
}

export async function set(key, value) {
  if (kvConfigured) {
    try {
      return await withRetry(() => kvSet(key, value));
    } catch (err) {
      console.error(`[Storage] KV unavailable for set("${key}"), using file fallback. Error: ${err.message}`);
      fileSet(key, value);
    }
    return;
  }
  fileSet(key, value);
}

export async function del(key) {
  if (kvConfigured) {
    try {
      return await withRetry(() => kvDel(key));
    } catch (err) {
      console.error(`[Storage] KV unavailable for del("${key}"), using file fallback. Error: ${err.message}`);
      fileDel(key);
    }
    return;
  }
  fileDel(key);
}

export const usingKv = kvConfigured;
