import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openAppDb, resetDbSingleton } from '@/services/cache/db';
import { compoundCache } from '@/services/cache/compoundStore';
import { NORMALIZE_SCHEMA_VERSION, DB_NAME, DB_VERSION } from '@/services/cache/schema';
import type { Compound } from '@/chemistry/compounds/types';
import { asCompoundId } from '@/chemistry/compounds/ids';

function makeCompound(cid: number, inchiKey = `AAAAAAAAAAAAAA-AAAAAAAAAA-${cid % 10}`): Compound {
  return {
    cid: asCompoundId(cid),
    provenance: 'runtime-fetch',
    name: { ko: null, en: `Compound ${cid}` },
    molecularFormula: 'H2O',
    molecularWeight: 18.015,
    smiles: 'O',
    inchi: 'InChI=1S/H2O/h1H2',
    inchiKey,
    iupacName: 'oxidane',
    synonyms: [],
    category: 'inorganic-common',
    priority: 9999,
    properties: {
      meltingPointK: null,
      boilingPointK: null,
      densityGPerCm3: null,
      standardState: 'unknown',
      waterSolubility: 'unknown',
      logP: null,
    },
    coordinateSource: 'rdkit-etkdg',
    defaultMolecule: null,
  };
}

beforeEach(() => {
  // Fresh IDB instance for each test
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  resetDbSingleton();
});

afterEach(() => {
  resetDbSingleton();
});

describe('compoundCache put → get round-trip', () => {
  it('stores and retrieves a compound by CID', async () => {
    const c = makeCompound(962, 'XLYOFNOQVPJJNP-UHFFFAOYSA-N');
    await compoundCache.put(c);
    const got = await compoundCache.get(962);
    expect(got).not.toBeNull();
    expect(got?.cid).toBe(962);
    expect(got?.molecularFormula).toBe('H2O');
  });

  it('returns null for unknown CID', async () => {
    const got = await compoundCache.get(999999);
    expect(got).toBeNull();
  });
});

describe('getByInchiKey', () => {
  it('retrieves compound by InChIKey', async () => {
    const c = makeCompound(962, 'XLYOFNOQVPJJNP-UHFFFAOYSA-N');
    await compoundCache.put(c);
    const got = await compoundCache.getByInchiKey('XLYOFNOQVPJJNP-UHFFFAOYSA-N');
    expect(got?.cid).toBe(962);
  });

  it('returns null for unknown InChIKey', async () => {
    const got = await compoundCache.getByInchiKey('XXXXXXXXXXXXXX-XXXXXXXXXX-X');
    expect(got).toBeNull();
  });
});

describe('schemaVersion mismatch', () => {
  it('returns null when schemaVersion does not match', async () => {
    // Directly insert a record with wrong schemaVersion
    const db = await openAppDb();
    const staleRecord = {
      value: makeCompound(1234, 'AAAAAAAAAAAAAAA-AAAAAAAAAA-A'),
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
      schemaVersion: NORMALIZE_SCHEMA_VERSION + 99, // wrong version
    };
    await db.put('compounds', staleRecord);

    const got = await compoundCache.get(1234);
    expect(got).toBeNull();
  });
});

describe('TTL expiration', () => {
  it('returns null for expired records', async () => {
    const db = await openAppDb();
    const expiredRecord = {
      value: makeCompound(5678, 'BBBBBBBBBBBBBB-BBBBBBBBBB-B'),
      cachedAt: Date.now() - 91 * 24 * 60 * 60 * 1000, // 91 days ago
      lastAccessedAt: Date.now() - 91 * 24 * 60 * 60 * 1000,
      schemaVersion: NORMALIZE_SCHEMA_VERSION,
    };
    await db.put('compounds', expiredRecord);

    const got = await compoundCache.get(5678);
    expect(got).toBeNull();
  });

  it('returns null for future cachedAt (clock skew)', async () => {
    const db = await openAppDb();
    const futureRecord = {
      value: makeCompound(9999, 'CCCCCCCCCCCCCC-CCCCCCCCCC-C'),
      cachedAt: Date.now() + 10_000_000, // future
      lastAccessedAt: Date.now(),
      schemaVersion: NORMALIZE_SCHEMA_VERSION,
    };
    await db.put('compounds', futureRecord);

    const got = await compoundCache.get(9999);
    expect(got).toBeNull();
  });
});

describe('LRU eviction', () => {
  it('evictLru removes excess entries by lastAccessedAt order', async () => {
    const db = await openAppDb();

    // Insert 5 entries with different lastAccessedAt times
    for (let i = 1; i <= 5; i++) {
      const record = {
        value: makeCompound(i, `AAAAAAAAAAAAAA-AAAAAAAAAA-${i}`),
        cachedAt: Date.now(),
        lastAccessedAt: Date.now() + i * 1000, // higher = more recent
        schemaVersion: NORMALIZE_SCHEMA_VERSION,
      };
      await db.put('compounds', record);
    }

    // Evict down to 3
    const removed = await compoundCache.evictLru(3);
    expect(removed).toBe(2);

    // CID 1 and 2 had oldest lastAccessedAt → should be evicted
    expect(await compoundCache.get(1)).toBeNull();
    expect(await compoundCache.get(2)).toBeNull();
    // CID 3, 4, 5 should remain
    expect(await compoundCache.get(3)).not.toBeNull();
    expect(await compoundCache.get(5)).not.toBeNull();
  });
});

describe('touch reorders LRU (§8.2#6)', () => {
  it('touch(cid) makes it survive eviction over un-touched newer entries', async () => {
    const db = await openAppDb();
    // cid1 oldest, cid3 newest by lastAccessedAt.
    for (const [cid, t] of [
      [1, 1000],
      [2, 2000],
      [3, 3000],
    ] as const) {
      await db.put('compounds', {
        value: makeCompound(cid, `AAAAAAAAAAAAAA-AAAAAAAAAA-${cid}`),
        cachedAt: Date.now(),
        lastAccessedAt: t,
        schemaVersion: NORMALIZE_SCHEMA_VERSION,
      });
    }
    // Touch cid1 → its lastAccessedAt becomes "now" (newest of all).
    await compoundCache.touch(1);
    // Keep only the single most-recently-accessed entry.
    await compoundCache.evictLru(1);

    expect(await compoundCache.get(1)).not.toBeNull(); // survived because touched
    expect(await compoundCache.get(2)).toBeNull();
    expect(await compoundCache.get(3)).toBeNull(); // newer-by-insert but evicted
  });
});

describe('clear', () => {
  it('removes all compound entries', async () => {
    await compoundCache.put(makeCompound(101, 'DDDDDDDDDDDDDD-DDDDDDDDDD-D'));
    await compoundCache.put(makeCompound(102, 'EEEEEEEEEEEEEE-EEEEEEEEEE-E'));
    await compoundCache.clear();

    expect(await compoundCache.get(101)).toBeNull();
    expect(await compoundCache.get(102)).toBeNull();
  });
});

describe('openAppDb upgrade idempotency', () => {
  it('second openAppDb call returns same schema', async () => {
    const db1 = await openAppDb();
    const db2 = await openAppDb();
    expect(db1).toBe(db2);
    // Store names are stable
    expect(db1.objectStoreNames.contains('compounds')).toBe(true);
  });
});

describe('onBlocking callback (§8.2#8)', () => {
  it('fires onBlocking when a newer-version open is requested while open', async () => {
    let blockingCalled = false;
    await openAppDb({
      onBlocking: () => {
        blockingCalled = true;
      },
    });

    // Open the same DB at a higher version while conn1 is still open →
    // conn1 receives a 'versionchange' event → idb invokes the `blocking` cb.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION + 1);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onblocked = () => resolve(); // still blocked by conn1 — that's the signal
      req.onerror = () => reject(req.error as Error);
    });
    await new Promise((r) => setTimeout(r, 0)); // flush the blocking event

    expect(blockingCalled).toBe(true);
  });
});
