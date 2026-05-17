import { describe, it, expect } from 'vitest';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import {
  viewportIdForAtom,
  viewportIdForBond,
  parseViewportId,
  parseSelectedAtoms,
} from '@/viewport/ids/viewportId';

const mol = 'a3f2-1111' as MoleculeId;
const atom = 'b1c4-2222' as AtomId;
const bond = 'c5d6-3333' as BondId;

describe('viewportId encode/decode', () => {
  it('encodes atom/bond composite ids', () => {
    expect(viewportIdForAtom(mol, atom)).toBe('a3f2-1111::a:b1c4-2222');
    expect(viewportIdForBond(mol, bond)).toBe('a3f2-1111::b:c5d6-3333');
  });

  it('round-trips atom', () => {
    expect(parseViewportId(viewportIdForAtom(mol, atom))).toEqual({
      kind: 'atom',
      molId: mol,
      atomId: atom,
    });
  });

  it('round-trips bond', () => {
    expect(parseViewportId(viewportIdForBond(mol, bond))).toEqual({
      kind: 'bond',
      molId: mol,
      bondId: bond,
    });
  });

  it('handles cid: molId (single colon, no :: collision)', () => {
    const cidMol = 'cid:962' as MoleculeId;
    const id = viewportIdForAtom(cidMol, atom);
    expect(parseViewportId(id)).toEqual({ kind: 'atom', molId: cidMol, atomId: atom });
  });

  it('rejects malformed input', () => {
    expect(parseViewportId('no-separator')).toBeNull();
    expect(parseViewportId('::a:x')).toBeNull(); // empty molId
    expect(parseViewportId('mol::x:atom')).toBeNull(); // bad prefix
    expect(parseViewportId('mol::a:')).toBeNull(); // empty id
    expect(parseViewportId('mol::')).toBeNull();
  });

  it('parseSelectedAtoms filters to atom kind', () => {
    const sel = [viewportIdForAtom(mol, atom), viewportIdForBond(mol, bond), 'garbage'];
    expect(parseSelectedAtoms(sel)).toEqual([{ molId: mol, atomId: atom }]);
  });
});
