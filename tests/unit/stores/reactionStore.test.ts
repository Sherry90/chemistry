import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactionResult } from '@/chemistry/reactions/types';
import type { ReactionEngineError } from '@/engine/reaction';

const { predict } = vi.hoisted(() => ({ predict: vi.fn() }));
vi.mock('@/engine/reaction', () => ({ predict }));
vi.mock('@/engine', () => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));

import { useReactionStore, __resetReactionInflight } from '@/stores/reactionStore';
import { makeInitialReactionState } from '@/stores/reactionStore.types';
import { mapReactionErrorToKey } from '@/stores/reactionStore.selectors';
import { selectIsExperimental } from '@/stores/reactionStore.selectors';
import type { MoleculeId } from '@/stores/_shared/types';
import { hardReset } from './_helpers';

const result = (over: Partial<ReactionResult> = {}): ReactionResult => ({
  products: [],
  kind: 'rule-based',
  appliedRuleId: 'r1',
  thermo: 'exothermic',
  notes: null,
  confidence: 0.9,
  ...over,
});

beforeEach(() => {
  __resetReactionInflight();
  hardReset(useReactionStore, makeInitialReactionState);
  vi.clearAllMocks();
});

describe('reactionStore — condition & reactants', () => {
  it('patchCondition merges partially', () => {
    useReactionStore.getState().actions.patchCondition({ temperatureK: 350 });
    const c = useReactionStore.getState().condition;
    expect(c.temperatureK).toBe(350);
    expect(c.pressureAtm).toBe(1.0);
  });

  it('addReactant keeps stable insertion order, no dupes', () => {
    const a = 'a' as MoleculeId;
    const b = 'b' as MoleculeId;
    const acts = useReactionStore.getState().actions;
    acts.addReactant(a);
    acts.addReactant(b);
    acts.addReactant(a);
    expect(useReactionStore.getState().reactantIds).toEqual([a, b]);
  });
});

describe('reactionStore — run', () => {
  it('success: run idle→loading→success, lastResult + experimental selector', async () => {
    predict.mockResolvedValue({ ok: true, value: result({ kind: 'heuristic-experimental' }) });
    const p = useReactionStore.getState().actions.run();
    expect(useReactionStore.getState().run.kind).toBe('loading');
    await p;
    const st = useReactionStore.getState();
    expect(st.run.kind).toBe('success');
    expect(st.lastResult?.appliedRuleId).toBe('r1');
    expect(st.lastAppliedRuleId).toBe('r1');
    expect(selectIsExperimental(st)).toBe(true);
  });

  it('two consecutive runs: only the latest commits (P5)', async () => {
    let resolveFirst!: (v: unknown) => void;
    predict
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r as (v: unknown) => void)))
      .mockResolvedValueOnce({ ok: true, value: result({ appliedRuleId: 'SECOND' }) });

    const p1 = useReactionStore.getState().actions.run();
    const p2 = useReactionStore.getState().actions.run();
    resolveFirst({ ok: true, value: result({ appliedRuleId: 'FIRST' }) });
    await Promise.all([p1, p2]);

    expect(useReactionStore.getState().lastAppliedRuleId).toBe('SECOND');
  });

  it('cancel() during a pending run resets run to idle', async () => {
    predict.mockImplementation(() => new Promise(() => {}));
    void useReactionStore.getState().actions.run();
    expect(useReactionStore.getState().run.kind).toBe('loading');
    useReactionStore.getState().actions.cancel();
    expect(useReactionStore.getState().run.kind).toBe('idle');
  });

  it('predict throw → run error kind=Internal', async () => {
    predict.mockRejectedValue(new Error('boom'));
    const out = await useReactionStore.getState().actions.run();
    expect(out.ok).toBe(false);
    const r = useReactionStore.getState().run;
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.error.kind).toBe('Internal');
  });

  it('module-level inflight controller is NOT in serialized state', () => {
    const keys = Object.keys(useReactionStore.getState());
    expect(keys).not.toContain('inflightReactionController');
  });
});

describe('mapReactionErrorToKey', () => {
  it('covers every ReactionEngineError kind', () => {
    const errs: ReactionEngineError[] = [
      { kind: 'RdkitNotReady', retryable: true },
      { kind: 'RdkitInitFailed', cause: { code: 'InternalError', message: 'x' }, retryable: false },
      { kind: 'NoMatchingRule', triedRuleIds: [], retryable: false },
      { kind: 'ConditionOutOfRange', nearestRuleIds: [], retryable: false },
      { kind: 'InvalidReactant', issues: [], retryable: false },
      { kind: 'RunReactantsFailed', ruleId: 'r', rdkitMessage: 'm', retryable: false },
      {
        kind: 'EmbedFailed',
        ruleId: null,
        cause: { code: 'EmbedFailed', message: 'e' },
        retryable: true,
      },
      { kind: 'Aborted', retryable: false },
      { kind: 'Internal', detail: 'd', retryable: false },
    ];
    for (const e of errs) {
      expect(mapReactionErrorToKey(e)).toMatch(/^reaction\.error\./);
    }
  });
});
