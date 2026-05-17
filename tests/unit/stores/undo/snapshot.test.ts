// Phase 09 §8.2 — snapshot 라운드트립 + immer 구조적 공유 + selection 무변경 + R12.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Molecule } from '@/chemistry/compounds/types';

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
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));

import { useMoleculeStore, __resetMoleculeInternals } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { useUiStore } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { readSnapshot, writeSnapshot } from '@/stores/_shared/undo/snapshot';
import { fakeMolecule, hardReset } from '../_helpers';

function seed(): { m1: Molecule; m2: Molecule } {
  const m1 = fakeMolecule();
  const m2 = fakeMolecule();
  useMoleculeStore.setState({
    molecules: { [m1.id]: m1, [m2.id]: m2 },
    ids: [m1.id, m2.id],
    activeId: m1.id,
  });
  return { m1, m2 };
}

beforeEach(() => {
  __resetMoleculeInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useUiStore, makeInitialUiState);
});

describe('snapshot', () => {
  it('read → mutate → write 라운드트립 후 store state 동일', () => {
    const { m1 } = seed();
    const before = readSnapshot();
    useMoleculeStore.getState().actions.moveAtom(m1.id, 0, [9, 9, 9]);
    expect(useMoleculeStore.getState().molecules[m1.id]!.atoms[0]!.position).toEqual({
      x: 9,
      y: 9,
      z: 9,
    });
    writeSnapshot(before);
    expect(useMoleculeStore.getState().molecules[m1.id]!.atoms[0]!.position).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    expect(useMoleculeStore.getState().ids).toEqual(before.ids);
    expect(useMoleculeStore.getState().activeId).toBe(before.activeId);
  });

  it('한 분자만 변경 시 미변경 분자는 동일 참조 보존 (immer 구조적 공유)', () => {
    const { m1, m2 } = seed();
    const prev = readSnapshot();
    useMoleculeStore.getState().actions.moveAtom(m1.id, 0, [1, 2, 3]);
    const next = readSnapshot();
    expect(next.molecules[m1.id]).not.toBe(prev.molecules[m1.id]); // 변경됨
    expect(next.molecules[m2.id]).toBe(prev.molecules[m2.id]); // 미변경 → 공유
  });

  it('writeSnapshot 후 useUiStore.selection 무변경', () => {
    const { m1 } = seed();
    useUiStore.getState().actions.setSelection({ atomIds: ['x::a:y'], bondIds: [] });
    const s = readSnapshot();
    useMoleculeStore.getState().actions.moveAtom(m1.id, 0, [5, 5, 5]);
    writeSnapshot(s);
    expect(useUiStore.getState().selection.atomIds).toEqual(['x::a:y']);
  });

  it('R12 — writeSnapshot(frozen) 후 store 액션 write 가 throw 하지 않음', () => {
    const { m1 } = seed();
    const prev = readSnapshot();
    useMoleculeStore.getState().actions.moveAtom(m1.id, 0, [7, 7, 7]);
    writeSnapshot(prev); // frozen 객체 대입
    expect(() => useMoleculeStore.getState().actions.moveAtom(m1.id, 0, [2, 2, 2])).not.toThrow();
    expect(useMoleculeStore.getState().molecules[m1.id]!.atoms[0]!.position).toEqual({
      x: 2,
      y: 2,
      z: 2,
    });
  });
});
