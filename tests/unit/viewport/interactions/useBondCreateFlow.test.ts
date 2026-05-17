// Phase 09 §8.6 — createBondFromSelection (D5).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';

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
import { createBondFromSelection } from '@/viewport/interactions/useBondCreateFlow';
import { viewportIdForAtom } from '@/viewport/ids/viewportId';
import type { AtomId, BondId } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from '../../stores/_helpers';

const A = ['a0', 'a1', 'a2'] as AtomId[];

function mol3(): Molecule {
  const atoms: Atom[] = A.map((id, i) => ({
    id,
    elementNumber: 6 as Atom['elementNumber'],
    position: { x: i, y: 0, z: 0 },
    formalCharge: 0,
    implicitHCount: 0,
  }));
  const bonds: Bond[] = [{ id: 'b0' as BondId, aAtomId: A[0]!, bAtomId: A[1]!, order: 1 }];
  return fakeMolecule({ atoms, bonds });
}

function seed1(): Molecule {
  const m = mol3();
  useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
  return m;
}

function select(...sids: string[]): void {
  useUiStore.getState().actions.setSelection({ atomIds: sids, bondIds: [] });
}

beforeEach(() => {
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useUiStore, makeInitialUiState);
});

describe('createBondFromSelection', () => {
  it('두 atom (같은 분자, 결합 없음) → addBond order=1, true', () => {
    const m = seed1();
    select(viewportIdForAtom(m.id, A[0]!), viewportIdForAtom(m.id, A[2]!));
    expect(createBondFromSelection()).toBe(true);
    const bonds = useMoleculeStore.getState().molecules[m.id]!.bonds;
    expect(bonds).toHaveLength(2);
    expect(bonds[1]!.order).toBe(1);
  });

  it('이미 결합 있는 쌍 → setBondOrder cycle 1→2', () => {
    const m = seed1();
    select(viewportIdForAtom(m.id, A[0]!), viewportIdForAtom(m.id, A[1]!));
    expect(createBondFromSelection()).toBe(true);
    expect(useMoleculeStore.getState().molecules[m.id]!.bonds[0]!.order).toBe(2);
  });

  it('atom 1개 선택 → no-op false', () => {
    const m = seed1();
    select(viewportIdForAtom(m.id, A[0]!));
    expect(createBondFromSelection()).toBe(false);
  });

  it('다른 분자 atom 쌍 → notify warn, false, addBond 미발화', () => {
    const m1 = mol3();
    const m2 = fakeMolecule();
    useMoleculeStore.setState({
      molecules: { [m1.id]: m1, [m2.id]: m2 },
      ids: [m1.id, m2.id],
      activeId: m1.id,
    });
    select(viewportIdForAtom(m1.id, A[0]!), viewportIdForAtom(m2.id, m2.atoms[0]!.id));
    expect(createBondFromSelection()).toBe(false);
    const ns = useUiStore.getState().notifications;
    expect(ns).toHaveLength(1);
    expect(ns[0]!.level).toBe('warn');
    expect(ns[0]!.messageKey).toBe('shortcuts.bondCreate.diffMolecule');
    expect(useMoleculeStore.getState().molecules[m1.id]!.bonds).toHaveLength(1);
  });
});
