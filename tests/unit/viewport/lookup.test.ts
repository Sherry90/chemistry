import { describe, it, expect } from 'vitest';
import { atomIdToIndex, bondIdToIndex, atomIndexToId } from '@/viewport/ids/lookup';
import { fakeMolecule } from '../stores/_helpers';
import type { AtomId, BondId } from '@/chemistry/compounds/ids';

const m = fakeMolecule();

describe('viewport ids/lookup', () => {
  it('atomIdToIndex finds index, -1 when absent', () => {
    expect(atomIdToIndex(m, m.atoms[1]!.id)).toBe(1);
    expect(atomIdToIndex(m, 'nope' as AtomId)).toBe(-1);
  });

  it('bondIdToIndex finds index, -1 when absent', () => {
    expect(bondIdToIndex(m, m.bonds[0]!.id)).toBe(0);
    expect(bondIdToIndex(m, 'nope' as BondId)).toBe(-1);
  });

  it('atomIndexToId maps back, null out of range', () => {
    expect(atomIndexToId(m, 0)).toBe(m.atoms[0]!.id);
    expect(atomIndexToId(m, 99)).toBeNull();
  });
});
