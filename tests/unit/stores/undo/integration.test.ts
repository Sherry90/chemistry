// Phase 09 §8.10 — 9 undoable 액션이 모두 createUndoStack 디스패처를 통과,
// undo→prev / redo→next 복원 (architecture §3.8 7 동작 + replace/remove).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Molecule, Atom } from '@/chemistry/compounds/types';

const { parseSmiles, toMoleculeWith3D } = vi.hoisted(() => ({
  parseSmiles: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/engine', () => ({ parseSmiles, parseInchi: vi.fn(), toMoleculeWith3D }));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));

import { useMoleculeStore, __resetMoleculeInternals } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { setUndoDispatcher, resetUndoDispatcher, createUndoStack } from '@/stores';
import type { AtomId } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from '../_helpers';

const acts = () => useMoleculeStore.getState().actions;
const st = () => useMoleculeStore.getState();

let stack: ReturnType<typeof createUndoStack>;

function seed(): Molecule {
  const m = fakeMolecule();
  useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
  return m;
}

beforeEach(() => {
  __resetMoleculeInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  stack = createUndoStack();
  setUndoDispatcher(stack);
});
afterEach(() => {
  resetUndoDispatcher();
});

describe('undo integration — 9 kinds', () => {
  it('molecule.create (addFromSmiles) → undo 제거 / redo 복원', async () => {
    parseSmiles.mockResolvedValue({ ok: true, value: { canonicalSmiles: 'CO' } });
    toMoleculeWith3D.mockResolvedValue({ ok: true, value: fakeMolecule() });
    const r = await acts().addFromSmiles('CO');
    expect(r.ok).toBe(true);
    expect(st().ids).toHaveLength(1);
    expect(stack.canUndo()).toBe(true);
    stack.undo();
    expect(st().ids).toHaveLength(0);
    stack.redo();
    expect(st().ids).toHaveLength(1);
  });

  it('atom.move → undo/redo', () => {
    const m = seed();
    acts().moveAtom(m.id, 0, [5, 6, 7]);
    expect(st().molecules[m.id]!.atoms[0]!.position).toEqual({ x: 5, y: 6, z: 7 });
    stack.undo();
    expect(st().molecules[m.id]!.atoms[0]!.position).toEqual({ x: 0, y: 0, z: 0 });
    stack.redo();
    expect(st().molecules[m.id]!.atoms[0]!.position).toEqual({ x: 5, y: 6, z: 7 });
  });

  it('bond.setOrder → undo/redo', () => {
    const m = seed();
    acts().setBondOrder(m.id, 0, 2);
    expect(st().molecules[m.id]!.bonds[0]!.order).toBe(2);
    stack.undo();
    expect(st().molecules[m.id]!.bonds[0]!.order).toBe(1);
    stack.redo();
    expect(st().molecules[m.id]!.bonds[0]!.order).toBe(2);
  });

  it('bond.create → undo 제거', () => {
    const m = seed(); // a0,a1 + bond. add a2 first then bond a0-a2.
    acts().addAtom(m.id, {
      id: 'a2' as AtomId,
      elementNumber: 6 as Atom['elementNumber'],
      position: { x: 2, y: 0, z: 0 },
      formalCharge: 0,
      implicitHCount: 0,
    });
    acts().addBond(m.id, 0, 2, 1);
    expect(st().molecules[m.id]!.bonds).toHaveLength(2);
    stack.undo(); // bond.create undo
    expect(st().molecules[m.id]!.bonds).toHaveLength(1);
    stack.redo();
    expect(st().molecules[m.id]!.bonds).toHaveLength(2);
  });

  it('bond.break → undo 복원', () => {
    const m = seed();
    acts().removeBond(m.id, 0);
    expect(st().molecules[m.id]!.bonds).toHaveLength(0);
    stack.undo();
    expect(st().molecules[m.id]!.bonds).toHaveLength(1);
  });

  it('atom.add → undo 제거', () => {
    const m = seed();
    acts().addAtom(m.id, {
      id: 'aX' as AtomId,
      elementNumber: 1 as Atom['elementNumber'],
      position: { x: 9, y: 0, z: 0 },
      formalCharge: 0,
      implicitHCount: 0,
    });
    expect(st().molecules[m.id]!.atoms).toHaveLength(3);
    stack.undo();
    expect(st().molecules[m.id]!.atoms).toHaveLength(2);
  });

  it('atom.remove → undo 복원 (매달린 결합 포함)', () => {
    const m = seed();
    acts().removeAtom(m.id, 0); // a0 제거 → bond 도 제거
    expect(st().molecules[m.id]!.atoms).toHaveLength(1);
    expect(st().molecules[m.id]!.bonds).toHaveLength(0);
    stack.undo();
    expect(st().molecules[m.id]!.atoms).toHaveLength(2);
    expect(st().molecules[m.id]!.bonds).toHaveLength(1);
  });

  it('molecule.replace → undo 복원', () => {
    const m = seed();
    const next = fakeMolecule({ canonicalSmiles: 'CCO' });
    acts().replace(m.id, next);
    expect(st().molecules[m.id]!.canonicalSmiles).toBe('CCO');
    stack.undo();
    expect(st().molecules[m.id]!.canonicalSmiles).toBe('CO');
    stack.redo();
    expect(st().molecules[m.id]!.canonicalSmiles).toBe('CCO');
  });

  it('molecule.remove → undo 복원', () => {
    const m = seed();
    acts().removeMolecule(m.id);
    expect(st().ids).toHaveLength(0);
    stack.undo();
    expect(st().ids).toHaveLength(1);
    expect(st().molecules[m.id]).toBeDefined();
  });

  it('새 액션 후 redo 비워짐 (P7) — 통합 경로', () => {
    const m = seed();
    acts().moveAtom(m.id, 0, [1, 1, 1]);
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    acts().moveAtom(m.id, 1, [2, 2, 2]);
    expect(stack.canRedo()).toBe(false);
  });
});
