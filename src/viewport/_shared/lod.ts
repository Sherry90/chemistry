// Phase 08 §6.12 — LOD 분기 (임계값은 Phase 14 가 튜닝, 본 Phase 는 분기만).
// Phase 14 W3-C1 — 'low' → 'medium' rename (LodLevel 3단계 정합: 'high'|'medium'|'line').
//                  `pickLodLevel`/`shouldUseLineBonds` 는 본 W3-C1 retrofit 이후
//                  `useLodLevel`(hysteresis 3단계) 로 대체된 dead code 이나, 외부 직접 import
//                  (테스트) 가 잔존하므로 시그니처만 유지.
import * as THREE from 'three';
import { DEFAULT_LOD_THRESHOLDS, type LodLevel, type LodThresholds } from './types';

export function pickLodLevel(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): LodLevel {
  return totalAtomCount >= thresholds.atomCountForLowSegments ? 'medium' : 'high';
}

export function shouldUseLineBonds(
  totalAtomCount: number,
  thresholds: LodThresholds = DEFAULT_LOD_THRESHOLDS,
): boolean {
  return totalAtomCount >= thresholds.atomCountForLineBonds;
}

const sphereCache = new Map<LodLevel, THREE.SphereGeometry>();
const cylinderCache = new Map<LodLevel, THREE.CylinderGeometry>();

/**
 * Phase 14 §4.1 — LodLevel 별 sphere segments:
 *   high → 16/8, medium → 8/4, line → 6/3 (line 에서도 atom picking 위해 소형 구체 유지).
 */
export function sphereGeometryFor(level: LodLevel): THREE.SphereGeometry {
  let g = sphereCache.get(level);
  if (!g) {
    g =
      level === 'high'
        ? new THREE.SphereGeometry(1, 16, 8)
        : level === 'medium'
          ? new THREE.SphereGeometry(1, 8, 4)
          : new THREE.SphereGeometry(1, 6, 3);
    sphereCache.set(level, g);
  }
  return g;
}

/**
 * Phase 14 §4.1 — LodLevel 별 cylinder radialSeg:
 *   high → 8, medium → 4, line → (LineBonds 가 대체, fallback 4).
 */
export function cylinderGeometryFor(level: LodLevel): THREE.CylinderGeometry {
  let g = cylinderCache.get(level);
  if (!g) {
    g =
      level === 'high'
        ? new THREE.CylinderGeometry(1, 1, 1, 8)
        : new THREE.CylinderGeometry(1, 1, 1, 4);
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
