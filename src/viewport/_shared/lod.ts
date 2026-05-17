// Phase 08 §6.12 — LOD 분기 (임계값은 Phase 14 가 튜닝, 본 Phase 는 분기만).
import * as THREE from 'three';
import { DEFAULT_LOD_THRESHOLDS, type LodLevel, type LodThresholds } from './types';

export function pickLodLevel(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): LodLevel {
  return totalAtomCount >= thresholds.atomCountForLowSegments ? 'low' : 'high';
}

export function shouldUseLineBonds(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): boolean {
  return totalAtomCount >= thresholds.atomCountForLineBonds;
}

const sphereCache = new Map<LodLevel, THREE.SphereGeometry>();
const cylinderCache = new Map<LodLevel, THREE.CylinderGeometry>();

export function sphereGeometryFor(level: LodLevel): THREE.SphereGeometry {
  let g = sphereCache.get(level);
  if (!g) {
    g = level === 'high' ? new THREE.SphereGeometry(1, 24, 16) : new THREE.SphereGeometry(1, 12, 8);
    sphereCache.set(level, g);
  }
  return g;
}

export function cylinderGeometryFor(level: LodLevel): THREE.CylinderGeometry {
  let g = cylinderCache.get(level);
  if (!g) {
    g =
      level === 'high'
        ? new THREE.CylinderGeometry(1, 1, 1, 16)
        : new THREE.CylinderGeometry(1, 1, 1, 8);
    cylinderCache.set(level, g);
  }
  return g;
}

/** 테스트/HMR: 캐시 geometry dispose. */
export function disposeLodCaches(): void {
  for (const g of sphereCache.values()) g.dispose();
  for (const g of cylinderCache.values()) g.dispose();
  sphereCache.clear();
  cylinderCache.clear();
}
