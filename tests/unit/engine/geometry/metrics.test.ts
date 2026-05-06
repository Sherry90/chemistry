import { describe, it, expect } from 'vitest';
import { bondLength, bondAngle, dihedral } from '@/engine/geometry/metrics';
import type { Atom } from '@/chemistry/compounds/types';
import { EMPTY_STEREO } from '@/types/stereo';

function atom(x: number, y: number, z: number): Atom {
  return {
    elementNumber: 6 as never,
    position: { x, y, z },
    formalCharge: 0,
    implicitHCount: 0,
  };
}

describe('bondLength', () => {
  it('distance between origin and (1,0,0) is 1', () => {
    expect(bondLength(atom(0, 0, 0), atom(1, 0, 0))).toBeCloseTo(1);
  });

  it('distance between (0,0,0) and (3,4,0) is 5', () => {
    expect(bondLength(atom(0, 0, 0), atom(3, 4, 0))).toBeCloseTo(5);
  });

  it('symmetric: bondLength(a,b) == bondLength(b,a)', () => {
    const a = atom(1, 2, 3);
    const b = atom(4, 5, 6);
    expect(bondLength(a, b)).toBeCloseTo(bondLength(b, a));
  });
});

describe('bondAngle', () => {
  it('90° angle', () => {
    // a=(1,0,0), b=(0,0,0), c=(0,1,0) → 90°
    const angle = bondAngle(atom(1, 0, 0), atom(0, 0, 0), atom(0, 1, 0));
    expect(angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('180° angle (linear)', () => {
    const angle = bondAngle(atom(-1, 0, 0), atom(0, 0, 0), atom(1, 0, 0));
    expect(angle).toBeCloseTo(Math.PI, 5);
  });

  it('60° angle (equilateral triangle)', () => {
    // vertices of equilateral triangle, angle at origin
    const angle = bondAngle(atom(1, 0, 0), atom(0, 0, 0), atom(0.5, Math.sqrt(3) / 2, 0));
    expect(angle).toBeCloseTo(Math.PI / 3, 4);
  });
});

describe('dihedral', () => {
  it('returns 0 for planar arrangement', () => {
    // All in xy plane, should be 0
    const d = dihedral(atom(0, 1, 0), atom(0, 0, 0), atom(1, 0, 0), atom(1, 1, 0));
    expect(Math.abs(d)).toBeCloseTo(0, 4);
  });

  it('returns ±π/2 for 90° twist', () => {
    // a in xy, d in xz → 90° dihedral
    const d = dihedral(atom(0, 1, 0), atom(0, 0, 0), atom(1, 0, 0), atom(1, 0, 1));
    expect(Math.abs(d)).toBeCloseTo(Math.PI / 2, 4);
  });
});

describe('validate', () => {
  it('validateMolecule accepts molecule with matching charges', async () => {
    const { validateMolecule } = await import('@/engine/parser/validate');
    const mol = {
      id: 'test',
      atoms: [
        {
          elementNumber: 8 as never,
          position: { x: 0, y: 0, z: 0 },
          formalCharge: 0,
          implicitHCount: 2,
        },
        {
          elementNumber: 1 as never,
          position: { x: 1, y: 0, z: 0 },
          formalCharge: 0,
          implicitHCount: 0,
        },
        {
          elementNumber: 1 as never,
          position: { x: -1, y: 0, z: 0 },
          formalCharge: 0,
          implicitHCount: 0,
        },
      ],
      bonds: [
        { aAtomId: 0, bAtomId: 1, order: 1 as const },
        { aAtomId: 0, bAtomId: 2, order: 1 as const },
      ],
      totalCharge: 0,
      canonicalSmiles: 'O',
      inchi: null,
      inchiKey: null,
      stereo: EMPTY_STEREO,
      spinMultiplicity: 1,
    };
    const result = validateMolecule(mol);
    expect(result.ok).toBe(true);
  });
});
