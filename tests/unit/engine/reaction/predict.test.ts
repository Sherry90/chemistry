import { describe, it, expect, vi, beforeEach } from 'vitest';

// RDKit 서비스 mock — predict 가 ensureRdkit/getRdkitStatus 호출.
vi.mock('@/engine/rdkit/service', () => ({
  ensureRdkit: vi.fn(async () => {}),
  getRdkitStatus: vi.fn(() => ({ phase: 'ready' })),
  getRdkitInstance: vi.fn(() => null),
}));

// heuristic mock — predict 의 분기 매핑 검증 (실제 RDKit embed 비의존).
const tryHeuristicMock = vi.fn();
vi.mock('@/engine/reaction/heuristic', () => ({
  tryHeuristic: (...args: unknown[]) => tryHeuristicMock(...args),
}));

import { predict } from '@/engine/reaction/predict';
import { clearReactionResultCache } from '@/engine/reaction/cache';
import { molecule, atom, condition } from './helpers';

const okInput = { reactants: [molecule({ atoms: [atom(8)] })], condition: condition() };

beforeEach(() => {
  clearReactionResultCache();
  tryHeuristicMock.mockReset();
});

describe('predict pipeline (rule engine deferred → heuristic path)', () => {
  it('empty reactants → InvalidReactant (before RDKit)', async () => {
    const r = await predict({ reactants: [], condition: condition() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('InvalidReactant');
      if (r.error.kind === 'InvalidReactant') expect(r.error.retryable).toBe(false);
    }
  });

  it('pre-aborted signal → Aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const r = await predict(okInput, { signal: ac.signal });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('Aborted');
  });

  it('heuristic ok → ReactionResult, cached on repeat', async () => {
    const result = {
      products: [],
      kind: 'heuristic-experimental' as const,
      appliedRuleId: null,
      thermo: 'unknown' as const,
      notes: 'reaction.experimentalDisclaimer',
      confidence: 0.25,
    };
    tryHeuristicMock.mockResolvedValue({ ok: true, value: result });
    const r1 = await predict(okInput);
    expect(r1.ok).toBe(true);
    const r2 = await predict(okInput);
    expect(r2.ok).toBe(true);
    expect(tryHeuristicMock).toHaveBeenCalledTimes(1); // 2번째는 캐시 히트
  });

  it('heuristic abstain → NoMatchingRule (triedRuleIds empty, deferred)', async () => {
    tryHeuristicMock.mockResolvedValue({
      ok: false,
      error: { kind: 'HeuristicAbstained', reason: 'no-candidate-pair' },
    });
    const r = await predict(okInput);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'NoMatchingRule') {
      expect(r.error.triedRuleIds).toEqual([]);
      expect(r.error.retryable).toBe(false);
    }
  });

  it('heuristic EmbedFailed → EmbedFailed (ruleId null, retryable)', async () => {
    tryHeuristicMock.mockResolvedValue({
      ok: false,
      error: { kind: 'EmbedFailed', cause: { code: 'EmbedFailed', message: 'x' } },
    });
    const r = await predict(okInput);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'EmbedFailed') {
      expect(r.error.ruleId).toBeNull();
      expect(r.error.retryable).toBe(true);
    }
  });
});
