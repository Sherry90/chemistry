// Phase 07 §8.6 — cross-store 일관성 시나리오.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactionResult } from '@/chemistry/reactions/types';

const { parseSmiles, toMoleculeWith3D, predict } = vi.hoisted(() => ({
  parseSmiles: vi.fn(),
  toMoleculeWith3D: vi.fn(),
  predict: vi.fn(),
}));
vi.mock('@/engine', () => ({ parseSmiles, parseInchi: vi.fn(), toMoleculeWith3D }));
vi.mock('@/engine/reaction', () => ({ predict }));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));

import { useMoleculeStore, __resetMoleculeInternals } from '@/stores/moleculeStore';
import { useReactionStore, __resetReactionInflight } from '@/stores/reactionStore';
import { useUiStore, __resetUiInternals } from '@/stores/uiStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { makeInitialReactionState } from '@/stores/reactionStore.types';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { fakeMolecule, hardReset } from './_helpers';

const rxResult: ReactionResult = {
  products: [],
  kind: 'rule-based',
  appliedRuleId: 'r1',
  thermo: 'exothermic',
  notes: null,
  confidence: 0.8,
};

beforeEach(() => {
  __resetMoleculeInternals();
  __resetReactionInflight();
  __resetUiInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useReactionStore, makeInitialReactionState);
  hardReset(useUiStore, makeInitialUiState);
  vi.clearAllMocks();
});

describe('integration — add → react → remove', () => {
  it('molecule flows into predict input and removal cascades', async () => {
    parseSmiles.mockResolvedValue({ ok: true, value: {} });
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    predict.mockImplementation(async (input: { reactants: unknown[] }) => {
      // reactionStore 가 moleculeStore 의 Molecule 을 _crossStore 경유로 수집해야 함.
      expect(input.reactants).toHaveLength(1);
      return { ok: true, value: rxResult };
    });

    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    const id = useMoleculeStore.getState().ids[0]!;

    // 선택에도 등록 (composite id 형식) → 삭제 시 정리되는지 검증.
    useUiStore.getState().actions.setSelection({ atomIds: [`${id}::a:a0`] });
    useReactionStore.getState().actions.addReactant(id);

    const out = await useReactionStore.getState().actions.run();
    expect(out.ok).toBe(true);
    expect(useReactionStore.getState().lastResult?.appliedRuleId).toBe('r1');

    useMoleculeStore.getState().actions.removeMolecule(id);
    expect(useReactionStore.getState().reactantIds).not.toContain(id);
    expect(useUiStore.getState().selection.atomIds).toHaveLength(0);
  });

  it('global loading is driven by async store actions via _crossStore', async () => {
    parseSmiles.mockImplementation(async () => {
      expect(useUiStore.getState().globalLoading.count).toBeGreaterThan(0);
      return { ok: true, value: {} };
    });
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });

    await useMoleculeStore.getState().actions.addFromSmiles('CO');
    expect(useUiStore.getState().globalLoading.count).toBe(0);
  });
});
