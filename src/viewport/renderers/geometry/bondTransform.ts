// Phase 08 §6.3 — cylinder 변환 (순수). 기본 cylinder: +Y 축, 길이 1, 반경 1.
import * as THREE from 'three';
import type { BondOrder } from '@/chemistry/bonds/types';

export type V3 = readonly [number, number, number];

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** A→B cylinder 의 instance Matrix4 (T·R·S). 길이는 |B−A|. */
export function bondTransform(a: V3, b: V3, radius: number): THREE.Matrix4 {
  const av = new THREE.Vector3(a[0], a[1], a[2]);
  const bv = new THREE.Vector3(b[0], b[1], b[2]);
  const mid = av.clone().add(bv).multiplyScalar(0.5);
  const dir = bv.clone().sub(av);
  const len = dir.length();
  const q = new THREE.Quaternion();
  if (len > 1e-9) q.setFromUnitVectors(Y_AXIS, dir.normalize());
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(radius, len, radius));
}

/** mid-split (D4): A→mid, mid→B 두 cylinder 변환. */
export function splitBondTransforms(
  a: V3,
  b: V3,
  radius: number,
): readonly [THREE.Matrix4, THREE.Matrix4] {
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return [bondTransform(a, mid, radius), bondTransform(mid, b, radius)];
}

/** 결합 차수별 평행 변위 배수 (BOND_PARALLEL_OFFSET 의 계수). */
export function parallelOffsetFactors(order: BondOrder): ReadonlyArray<number> {
  switch (order) {
    case 1:
      return [0];
    case 2:
      return [-0.5, 0.5];
    case 3:
      return [-1, 0, 1];
    case 'aromatic':
      return [0]; // 단일 cyl + dashed overlay (AromaticOverlay)
  }
}

/** axis 와 ref(기본 카메라 right, 폴백 X/Z) 의 외적 정규화 — 평행 결합 변위 방향. */
export function perpendicularTo(axis: V3, ref: V3 = [1, 0, 0]): V3 {
  const ax = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
  let r = new THREE.Vector3(ref[0], ref[1], ref[2]);
  if (Math.abs(ax.dot(r)) > 0.99) r = new THREE.Vector3(0, 0, 1); // 평행 회피
  const p = new THREE.Vector3().crossVectors(ax, r).normalize();
  return [p.x, p.y, p.z];
}
