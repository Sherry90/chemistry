import type { Condition, ReactionResult } from '@/chemistry/reactions/types';
import type { Molecule } from '@/chemistry/compounds/types';

// Phase 06 §6.8 — 결과 LRU. 키에 rulesetVersion 포함 → 청크 핫스왑 시 stale 자동 무효 (P8).
interface Entry {
  readonly key: string;
  value: ReactionResult;
  lastHitAt: number;
}

let _tick = 0;
const CAPACITY = 256;
const map = new Map<string, Entry>();

export function reactionCacheKey(
  reactants: ReadonlyArray<Molecule>,
  condition: Condition,
  rulesetVersion: string,
): string {
  const smiles = reactants
    .map((m) => m.canonicalSmiles)
    .slice()
    .sort()
    .join('|');
  const cond = `${condition.temperatureK.toFixed(1)}_${condition.pressureAtm.toFixed(2)}_${
    condition.pH ?? 'null'
  }`;
  return `${smiles}::${cond}::${rulesetVersion}`;
}

export function getCachedResult(key: string): ReactionResult | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  e.lastHitAt = ++_tick;
  return e.value;
}

export function setCachedResult(key: string, value: ReactionResult): void {
  const existing = map.get(key);
  if (existing) {
    existing.value = value;
    existing.lastHitAt = ++_tick;
    return;
  }
  if (map.size >= CAPACITY) {
    let oldest: Entry | null = null;
    for (const e of map.values()) {
      if (!oldest || e.lastHitAt < oldest.lastHitAt) oldest = e;
    }
    if (oldest) map.delete(oldest.key);
  }
  map.set(key, { key, value, lastHitAt: ++_tick });
}

export function clearReactionResultCache(): void {
  map.clear();
}
