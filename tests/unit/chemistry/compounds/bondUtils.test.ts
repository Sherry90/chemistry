// Phase 09 §6.4.1 — bondUtils 순수 도메인 검증.
import { describe, it, expect } from 'vitest';
import { existsBond, findBondIndex } from '@/chemistry/compounds/bondUtils';
import { fakeMolecule } from '../../stores/_helpers';

const mol = fakeMolecule(); // atoms[0]=a0, atoms[1]=a1, bonds[0]= a0-a1

describe('bondUtils', () => {
  it('existsBond true for bonded pair (any order)', () => {
    expect(existsBond(mol, 0, 1)).toBe(true);
    expect(existsBond(mol, 1, 0)).toBe(true);
  });

  it('findBondIndex returns bonds[] index', () => {
    expect(findBondIndex(mol, 0, 1)).toBe(0);
    expect(findBondIndex(mol, 1, 0)).toBe(0);
  });

  it('no bond → false / -1', () => {
    const m = fakeMolecule({ bonds: [] });
    expect(existsBond(m, 0, 1)).toBe(false);
    expect(findBondIndex(m, 0, 1)).toBe(-1);
  });

  it('out-of-range or self pair → false / -1', () => {
    expect(existsBond(mol, 0, 9)).toBe(false);
    expect(findBondIndex(mol, -1, 0)).toBe(-1);
    expect(findBondIndex(mol, 0, 0)).toBe(-1);
  });
});
