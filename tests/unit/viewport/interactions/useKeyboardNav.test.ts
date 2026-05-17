// Phase 09 §8.5 — navAtom atomIndex cycle (D7).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Molecule, Atom } from '@/chemistry/compounds/types';

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

import { useMoleculeStore } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { useUiStore } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { navAtom } from '@/viewport/interactions/useKeyboardNav';
import { viewportIdForAtom, parseViewportId } from '@/viewport/ids/viewportId';
import type { AtomId } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from '../../stores/_helpers';

const AIDS = ['a0', 'a1', 'a2', 'a3', 'a4'] as AtomId[];

function mol5(): Molecule {
  const atoms: Atom[] = AIDS.map((id, i) => ({
    id,
    elementNumber: 6 as Atom['elementNumber'],
    position: { x: i, y: 0, z: 0 },
    formalCharge: 0,
    implicitHCount: 0,
  }));
  return fakeMolecule({ atoms, bonds: [] });
}

function seed(activeNull = false): Molecule {
  const m = mol5();
  useMoleculeStore.setState({
    molecules: { [m.id]: m },
    ids: [m.id],
    activeId: activeNull ? null : m.id,
  });
  return m;
}

function selectIdx(m: Molecule, idx: number): void {
  useUiStore.getState().actions.setSelection({
    atomIds: [viewportIdForAtom(m.id, AIDS[idx]!)],
    bondIds: [],
  });
}

function curIdx(): number {
  const a = useUiStore.getState().selection.atomIds[0];
  if (!a) return -1;
  const p = parseViewportId(a);
  return p && p.kind === 'atom' ? AIDS.indexOf(p.atomId) : -1;
}

beforeEach(() => {
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useUiStore, makeInitialUiState);
});

describe('navAtom', () => {
  it('선택 없음 + next → atomIndex 0', () => {
    seed();
    navAtom(1);
    expect(curIdx()).toBe(0);
  });

  it('선택 없음 + prev → 마지막 atomIndex', () => {
    seed();
    navAtom(-1);
    expect(curIdx()).toBe(4);
  });

  it('idx2 → next 3, prev 1', () => {
    const m = seed();
    selectIdx(m, 2);
    navAtom(1);
    expect(curIdx()).toBe(3);
    selectIdx(m, 2);
    navAtom(-1);
    expect(curIdx()).toBe(1);
  });

  it('idx4 + next → 0 (cycle), idx0 + prev → 4', () => {
    const m = seed();
    selectIdx(m, 4);
    navAtom(1);
    expect(curIdx()).toBe(0);
    selectIdx(m, 0);
    navAtom(-1);
    expect(curIdx()).toBe(4);
  });

  it('active 분자 없으면 no-op', () => {
    seed(true);
    navAtom(1);
    expect(useUiStore.getState().selection.atomIds).toEqual([]);
  });
});
