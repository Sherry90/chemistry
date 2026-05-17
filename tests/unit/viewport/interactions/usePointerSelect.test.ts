// Phase 09 §8.4 — selectFromPick 단일/Shift 토글/빈영역.
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { useUiStore } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { selectFromPick } from '@/viewport/interactions/usePointerSelect';
import { viewportIdForAtom } from '@/viewport/ids/viewportId';
import type { MoleculeId, AtomId, BondId } from '@/chemistry/compounds/ids';
import type { PickedTarget } from '@/viewport/ids/picking';
import { hardReset } from '../../stores/_helpers';

const M = 'm1' as MoleculeId;
const atom = (a: string): PickedTarget => ({
  kind: 'atom',
  molId: M,
  atomId: a as AtomId,
});
const bond = (b: string): PickedTarget => ({
  kind: 'bond',
  molId: M,
  bondId: b as BondId,
});
const sel = () => useUiStore.getState().selection;

beforeEach(() => hardReset(useUiStore, makeInitialUiState));

describe('selectFromPick', () => {
  it('일반 클릭 → 단일 선택 교체', () => {
    selectFromPick(atom('x'), false);
    expect(sel().atomIds).toEqual([viewportIdForAtom(M, 'x' as AtomId)]);
    selectFromPick(atom('y'), false);
    expect(sel().atomIds).toEqual([viewportIdForAtom(M, 'y' as AtomId)]);
  });

  it('Shift+클릭 동일 atom → 토글 해제', () => {
    selectFromPick(atom('x'), false);
    selectFromPick(atom('x'), true);
    expect(sel().atomIds).toEqual([]);
  });

  it('Shift+클릭 다른 atom → 추가', () => {
    selectFromPick(atom('x'), false);
    selectFromPick(atom('y'), true);
    expect(sel().atomIds).toHaveLength(2);
  });

  it('빈 영역 클릭 (no-shift) → clearSelection', () => {
    selectFromPick(atom('x'), false);
    selectFromPick(null, false);
    expect(sel().atomIds).toEqual([]);
  });

  it('빈 영역 클릭 (shift) → 보존', () => {
    selectFromPick(atom('x'), false);
    selectFromPick(null, true);
    expect(sel().atomIds).toHaveLength(1);
  });

  it('bond pick 단일 선택', () => {
    selectFromPick(bond('b0'), false);
    expect(sel().bondIds).toHaveLength(1);
    expect(sel().atomIds).toEqual([]);
  });
});
