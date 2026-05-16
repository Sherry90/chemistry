import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { AppDbSchema } from './schema';
import { DB_NAME, DB_VERSION } from './schema';

export interface OpenDbOptions {
  readonly onBlocking?: () => void;
  readonly onBlocked?: () => void;
}

let dbPromise: Promise<IDBPDatabase<AppDbSchema>> | null = null;

/**
 * Open (or reuse) the singleton IndexedDB connection.
 * v0 → v1: creates `compounds` store with `by-inchi-key` and `by-last-accessed` indexes.
 * Future stores are added in v2, v3, ... increments here.
 */
export function openAppDb(opts?: OpenDbOptions): Promise<IDBPDatabase<AppDbSchema>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<AppDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Sequential migrations — each case falls through intentionally.
      switch (oldVersion) {
        case 0: {
          const store = db.createObjectStore('compounds', { keyPath: 'value.cid' });
          // unique index on InChIKey for O(1) reverse lookup
          store.createIndex('by-inchi-key', 'value.inchiKey', { unique: true });
          // non-unique index on lastAccessedAt for LRU eviction ordering
          store.createIndex('by-last-accessed', 'lastAccessedAt', { unique: false });
        }
      }
    },
    blocked() {
      opts?.onBlocked?.();
    },
    blocking() {
      opts?.onBlocking?.();
    },
  });

  return dbPromise;
}

/** Reset singleton for testing. */
export function resetDbSingleton(): void {
  dbPromise = null;
}
