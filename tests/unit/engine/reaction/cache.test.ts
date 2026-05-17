import { describe, it, expect, beforeEach } from 'vitest';
import {
  reactionCacheKey,
  getCachedResult,
  setCachedResult,
  clearReactionResultCache,
} from '@/engine/reaction/cache';
import { molecule, condition } from './helpers';
import type { ReactionResult } from '@/chemistry/reactions/types';

const result: ReactionResult = {
  products: [],
  kind: 'heuristic-experimental',
  appliedRuleId: null,
  thermo: 'unknown',
  notes: null,
  confidence: 0.25,
};

beforeEach(() => clearReactionResultCache());

describe('reaction result cache', () => {
  it('miss → undefined, hit after set', () => {
    const m = [molecule({ canonicalSmiles: 'CCO' })];
    const c = condition();
    const k = reactionCacheKey(m, c, 'v1');
    expect(getCachedResult(k)).toBeUndefined();
    setCachedResult(k, result);
    expect(getCachedResult(k)).toBe(result);
  });

  it('rulesetVersion change → key changes → stale auto-invalidated (P8)', () => {
    const m = [molecule({ canonicalSmiles: 'CCO' })];
    const c = condition();
    const k1 = reactionCacheKey(m, c, 'v1');
    const k2 = reactionCacheKey(m, c, 'v2');
    expect(k1).not.toBe(k2);
    setCachedResult(k1, result);
    expect(getCachedResult(k2)).toBeUndefined();
  });

  it('reactant order independent (sorted SMILES)', () => {
    const a = molecule({ canonicalSmiles: 'A' });
    const b = molecule({ canonicalSmiles: 'B' });
    const c = condition();
    expect(reactionCacheKey([a, b], c, 'v')).toBe(reactionCacheKey([b, a], c, 'v'));
  });
});
