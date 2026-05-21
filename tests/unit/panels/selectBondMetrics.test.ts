// Phase 11 §8.1 U3 — selectBondMetrics standalone 순수 함수 + WeakMap memoize.
// 메탄 (CH4) 정사면체 좌표 → length 표 4 행, angle 표 6 행 (~109.47°).
import { describe, it, expect } from 'vitest';
import type { Molecule } from '@/chemistry/compounds/types';
import type { Bond, BondOrder } from '@/chemistry/bonds/types';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';
import { selectBondMetrics } from '@/stores/moleculeStore.selectors';

// 정사면체 메탄 — 결합 길이 1.09 Å, H-C-H 각 acos(-1/3) ≈ 109.4712°.
function methaneFixture(): Molecule {
  const R = 1.09;
  const k = R / Math.sqrt(3);
  const c = 'c' as AtomId;
  const h1 = 'h1' as AtomId;
  const h2 = 'h2' as AtomId;
  const h3 = 'h3' as AtomId;
  const h4 = 'h4' as AtomId;
  const bond = (id: string, a: AtomId, b: AtomId): Bond => ({
    id: id as BondId,
    aAtomId: a,
    bAtomId: b,
    order: 1 as BondOrder,
  });
  return {
    id: 'm-methane' as MoleculeId,
    atoms: [
      {
        id: c,
        elementNumber: 6 as ElementNumber,
        position: { x: 0, y: 0, z: 0 },
        formalCharge: 0,
        implicitHCount: 0,
      },
      {
        id: h1,
        elementNumber: 1 as ElementNumber,
        position: { x: k, y: k, z: k },
        formalCharge: 0,
        implicitHCount: 0,
      },
      {
        id: h2,
        elementNumber: 1 as ElementNumber,
        position: { x: k, y: -k, z: -k },
        formalCharge: 0,
        implicitHCount: 0,
      },
      {
        id: h3,
        elementNumber: 1 as ElementNumber,
        position: { x: -k, y: k, z: -k },
        formalCharge: 0,
        implicitHCount: 0,
      },
      {
        id: h4,
        elementNumber: 1 as ElementNumber,
        position: { x: -k, y: -k, z: k },
        formalCharge: 0,
        implicitHCount: 0,
      },
    ],
    bonds: [bond('b1', c, h1), bond('b2', c, h2), bond('b3', c, h3), bond('b4', c, h4)],
    totalCharge: 0,
    canonicalSmiles: 'C',
    inchi: null,
    inchiKey: null,
    stereo: { atomStereo: [], bondStereo: [] },
    spinMultiplicity: 1,
  };
}

describe('selectBondMetrics — methane (CH4) tetrahedral', () => {
  it('null 입력 → null', () => {
    expect(selectBondMetrics(null)).toBeNull();
  });

  it('4 결합 → lengths 4 행, 모두 ≈ 1.09 Å, atom1=C / atom2=H', () => {
    const result = selectBondMetrics(methaneFixture());
    expect(result).not.toBeNull();
    expect(result!.lengths).toHaveLength(4);
    for (const bm of result!.lengths) {
      expect(bm.lengthAngstrom).toBeCloseTo(1.09, 5);
      expect(bm.atom1Symbol).toBe('C');
      expect(bm.atom2Symbol).toBe('H');
      expect(bm.order).toBe(1);
    }
  });

  it('인접 결합 쌍 (vertex=C) → angles 6 행, 모두 ≈ 109.4712°', () => {
    const result = selectBondMetrics(methaneFixture())!;
    expect(result.angles).toHaveLength(6); // C(4,2) = 6
    for (const am of result.angles) {
      expect(am.angleDegrees).toBeCloseTo(109.4712, 3);
      expect(am.atom2Index).toBe(0); // vertex = C (atoms[0])
    }
  });

  it('WeakMap memoize — 동일 분자 참조 → 동일 결과 참조', () => {
    const m = methaneFixture();
    const a = selectBondMetrics(m);
    const b = selectBondMetrics(m);
    expect(a).toBe(b); // 참조 동일성 (객체 재계산 안 됨)
  });

  it('다른 분자 인스턴스 → 다른 결과 참조 (cache miss → 재계산)', () => {
    const a = selectBondMetrics(methaneFixture());
    const b = selectBondMetrics(methaneFixture());
    expect(a).not.toBe(b);
    expect(a!.lengths).toHaveLength(b!.lengths.length);
  });
});
