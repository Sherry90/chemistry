import type { DBSchema } from 'idb';
import type { Compound } from '@/chemistry/compounds/types';

// CD1: 캐시된 Compound 런타임 형태(brand ID·provenance·Molecule 구조) 변경 →
// 구 스키마 캐시 레코드 무효화 위해 bump.
export const NORMALIZE_SCHEMA_VERSION = 2 as const;

export interface CacheRecord<T> {
  readonly value: T;
  readonly cachedAt: number;
  readonly lastAccessedAt: number;
  readonly schemaVersion: number;
}

export type CachedCompound = CacheRecord<Compound>;

export interface AppDbSchema extends DBSchema {
  compounds: {
    key: number;
    value: CachedCompound;
    indexes: {
      'by-inchi-key': string;
      'by-last-accessed': number;
    };
  };
}

export const DB_NAME = 'chemistry-app';
export const DB_VERSION = 1;
