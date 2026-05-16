import type { Compound } from '@/chemistry/compounds/types';
import type { IDBPDatabase } from 'idb';
import type { AppDbSchema, CachedCompound } from './schema';
import { NORMALIZE_SCHEMA_VERSION } from './schema';
import { toCacheError } from './errors';
import { openAppDb } from './db';

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_ENTRIES = 1000;

function isValid(record: CachedCompound): boolean {
  const now = Date.now();
  if (record.schemaVersion !== NORMALIZE_SCHEMA_VERSION) return false;
  if (record.cachedAt > now) return false; // future timestamp (clock skew)
  if (now - record.cachedAt > TTL_MS) return false;
  return true;
}

async function getDb(): Promise<IDBPDatabase<AppDbSchema>> {
  return openAppDb();
}

async function getCompound(cid: number): Promise<Compound | null> {
  try {
    const db = await getDb();
    const record = await db.get('compounds', cid);
    if (!record || !isValid(record)) return null;
    // Touch: update lastAccessedAt in background (non-blocking)
    touchCompound(cid).catch(() => undefined);
    return record.value;
  } catch {
    return null;
  }
}

async function getByInchiKey(key: string): Promise<Compound | null> {
  try {
    const db = await getDb();
    const record = await db.getFromIndex('compounds', 'by-inchi-key', key);
    if (!record || !isValid(record)) return null;
    touchCompound(record.value.cid!).catch(() => undefined);
    return record.value;
  } catch {
    return null;
  }
}

async function putCompound(compound: Compound): Promise<void> {
  if (compound.cid === null) return;
  const now = Date.now();
  const record: CachedCompound = {
    value: compound,
    cachedAt: now,
    lastAccessedAt: now,
    schemaVersion: NORMALIZE_SCHEMA_VERSION,
  };
  try {
    const db = await getDb();
    const tx = db.transaction('compounds', 'readwrite');
    await tx.store.put(record);
    const count = await tx.store.count();
    if (count > MAX_ENTRIES) {
      const excess = count - MAX_ENTRIES;
      const index = tx.store.index('by-last-accessed');
      let cursor = await index.openCursor();
      let deleted = 0;
      while (cursor && deleted < excess) {
        await cursor.delete();
        deleted++;
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  } catch (e) {
    const cacheErr = toCacheError(e);
    if (cacheErr.kind === 'QuotaExceeded') {
      // Aggressive eviction: remove half the entries, then retry once
      try {
        const db = await getDb();
        await evictLru(db, Math.floor(MAX_ENTRIES / 2));
        const tx2 = db.transaction('compounds', 'readwrite');
        await tx2.store.put(record);
        await tx2.done;
      } catch {
        // Give up silently — cache write failure is non-fatal
      }
    }
  }
}

async function touchCompound(cid: number): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('compounds', 'readwrite');
    const record = await tx.store.get(cid);
    if (record) {
      await tx.store.put({ ...record, lastAccessedAt: Date.now() });
    }
    await tx.done;
  } catch {
    // Non-fatal
  }
}

async function evictLru(db: IDBPDatabase<AppDbSchema>, maxEntries: number): Promise<number> {
  const count = await db.count('compounds');
  if (count <= maxEntries) return 0;
  const excess = count - maxEntries;
  const tx = db.transaction('compounds', 'readwrite');
  const index = tx.store.index('by-last-accessed');
  let cursor = await index.openCursor();
  let deleted = 0;
  while (cursor && deleted < excess) {
    await cursor.delete();
    deleted++;
    cursor = await cursor.continue();
  }
  await tx.done;
  return deleted;
}

async function evictLruPublic(maxEntries: number): Promise<number> {
  try {
    const db = await getDb();
    return evictLru(db, maxEntries);
  } catch {
    return 0;
  }
}

async function clearCompounds(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear('compounds');
  } catch {
    // Non-fatal
  }
}

export const compoundCache = {
  get: getCompound,
  getByInchiKey,
  put: putCompound,
  touch: touchCompound,
  evictLru: evictLruPublic,
  clear: clearCompounds,
};
