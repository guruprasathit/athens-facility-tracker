// api/_storage.js — Athens Community Facility Tracker
// Uses Vercel KV when configured (persistent), falls back to file storage otherwise.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// ── FILE STORAGE FALLBACK ────────────────────────────────────────────────────
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

// ── KV STORAGE (Vercel KV / Upstash Redis) ───────────────────────────────────
let kv;
if (kvConfigured) {
  const mod = await import('@vercel/kv');
  kv = mod.kv;
}

// ── UNIFIED API ──────────────────────────────────────────────────────────────
export async function get(key) {
  if (kvConfigured) return await kv.get(key);
  return fileGet(key);
}

export async function set(key, value) {
  if (kvConfigured) return await kv.set(key, value);
  fileSet(key, value);
}

export async function del(key) {
  if (kvConfigured) return await kv.del(key);
  fileDel(key);
}

export const usingKv = kvConfigured;
