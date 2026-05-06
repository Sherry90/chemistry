import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE_DIR } from '../config.js';

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200);
}

function cachePath(key: string): string {
  return resolve(CACHE_DIR, `${sanitizeKey(key)}.json`);
}

function cachePathRaw(key: string): string {
  return resolve(CACHE_DIR, `${sanitizeKey(key)}.raw`);
}

async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const path = cachePath(key);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  await ensureCacheDir();
  await writeFile(cachePath(key), JSON.stringify(value, null, 2), 'utf8');
}

export async function getCachedRaw(key: string): Promise<string | null> {
  const path = cachePathRaw(key);
  if (!existsSync(path)) return null;
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function setCachedRaw(key: string, value: string): Promise<void> {
  await ensureCacheDir();
  await writeFile(cachePathRaw(key), value, 'utf8');
}
