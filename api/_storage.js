// api/_storage.js — file-based storage (no external services required)
// Uses /tmp on Vercel (writable, no config needed) and ./data locally.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp/athens-data' : join(process.cwd(), 'data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export function get(key) {
  const file = join(DATA_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export function set(key, value) {
  writeFileSync(join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}

export function del(key) {
  const file = join(DATA_DIR, `${key}.json`);
  if (existsSync(file)) { try { unlinkSync(file); } catch {} }
}
