import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  bondTransform,
  splitBondTransforms,
  parallelOffsetFactors,
  perpendicularTo,
} from '@/viewport/renderers/geometry/bondTransform';

const decompose = (m: THREE.Matrix4) => {
  const t = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(t, q, s);
  return { t, q, s };
};

describe('bondTransform', () => {
  it('H2O O-H: length 0.96, mid (0.48,0,0), +Y→+X rotation', () => {
    const m = bondTransform([0, 0, 0], [0.96, 0, 0], 0.08);
    const { t, s } = decompose(m);
    expect(t.x).toBeCloseTo(0.48, 6);
    expect(t.y).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(0.96, 6); // length on Y scale
    expect(s.x).toBeCloseTo(0.08, 6);
    // +Y rotated to +X: apply quaternion to (0,1,0) → (1,0,0)
    const { q } = decompose(m);
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(0, 6);
  });

  it('CH4 C-H: length √(3·0.629²) ≈ 1.0894, axis (1,1,1)/√3', () => {
    const m = bondTransform([0, 0, 0], [0.629, 0.629, 0.629], 0.08);
    const { q, s } = decompose(m);
    expect(s.y).toBeCloseTo(Math.sqrt(3 * 0.629 ** 2), 6);
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const inv = 1 / Math.sqrt(3);
    expect(v.x).toBeCloseTo(inv, 6);
    expect(v.y).toBeCloseTo(inv, 6);
    expect(v.z).toBeCloseTo(inv, 6);
  });

  it('splitBondTransforms: two half cylinders meeting at mid', () => {
    const [m1, m2] = splitBondTransforms([0, 0, 0], [2, 0, 0], 0.08);
    expect(decompose(m1).t.x).toBeCloseTo(0.5, 6);
    expect(decompose(m2).t.x).toBeCloseTo(1.5, 6);
    expect(decompose(m1).s.y).toBeCloseTo(1, 6);
  });

  it('parallelOffsetFactors per order', () => {
    expect(parallelOffsetFactors(1)).toEqual([0]);
    expect(parallelOffsetFactors(2)).toEqual([-0.5, 0.5]);
    expect(parallelOffsetFactors(3)).toEqual([-1, 0, 1]);
    expect(parallelOffsetFactors('aromatic')).toEqual([0]);
  });

  it('perpendicularTo is orthogonal to axis', () => {
    const p = perpendicularTo([0, 1, 0]);
    expect(Math.abs(p[0] * 0 + p[1] * 1 + p[2] * 0)).toBeLessThan(1e-6);
  });
});
