import type { ParsedMol } from './types';
import type { Molecule } from '@/chemistry/compounds/types';

interface CacheEntry<V> {
  readonly key: string;
  value: V;
  lastHitAt: number;
}

let _tick = 0;
function nextTick(): number {
  return ++_tick;
}

class LRUCache<V> {
  private readonly map = new Map<string, CacheEntry<V>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    entry.lastHitAt = nextTick();
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      const entry = this.map.get(key)!;
      entry.value = value;
      entry.lastHitAt = nextTick();
      return;
    }
    if (this.map.size >= this.maxEntries) {
      this.evict();
    }
    this.map.set(key, { key, value, lastHitAt: nextTick() });
  }

  private evict(): void {
    let oldest: CacheEntry<V> | null = null;
    for (const entry of this.map.values()) {
      if (!oldest || entry.lastHitAt < oldest.lastHitAt) {
        oldest = entry;
      }
    }
    if (oldest) this.map.delete(oldest.key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const MAX_ENTRIES = 200;

const parseCache = new LRUCache<ParsedMol>(MAX_ENTRIES);
const embedCache = new LRUCache<Molecule>(MAX_ENTRIES);

export function getParsedMol(kind: string, normalized: string): ParsedMol | undefined {
  return parseCache.get(`parse:${kind}:${normalized}`);
}

export function setParsedMol(kind: string, normalized: string, mol: ParsedMol): void {
  parseCache.set(`parse:${kind}:${normalized}`, mol);
}

export function getEmbedded(
  parsedHash: string,
  seed: number,
  optimize: string,
): Molecule | undefined {
  return embedCache.get(`embed:${parsedHash}:${seed}:${optimize}`);
}

export function setEmbedded(
  parsedHash: string,
  seed: number,
  optimize: string,
  mol: Molecule,
): void {
  embedCache.set(`embed:${parsedHash}:${seed}:${optimize}`, mol);
}

export function disposeCache(): void {
  parseCache.clear();
  embedCache.clear();
}

export { parseCache, embedCache };
