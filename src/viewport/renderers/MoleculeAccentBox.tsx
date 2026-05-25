// Phase 15 hotfix — 멀티 분자 가시 구분.
// 사용자 보고 "각 분자별 색깔이 구분되어야" → 원자 CPK 색은 보존하면서 (chemistry
// convention) 분자 단위 정체성은 외곽 wireframe 박스 색상으로 표시.
// 1 분자 일때는 미렌더 — 시각 클러터 방지.
import * as THREE from 'three';
import { useMemo } from 'react';
import type * as React from 'react';
import type { Molecule } from '@/chemistry/compounds/types';
import { useMoleculeStore, selectMoleculeIds } from '@/stores';
import { computeBBox } from '../scene/layout';

// Wong (2011) CVD-safe palette 7 색 — yellow 는 dark 배경 위 명도 낮아 제외하지 않고
// 유지 (theme.css 의 cvd accent 와 별개 — 본 위치는 ambient outline). 검정 제외.
const MOLECULE_PALETTE = [
  '#56B4E9',
  '#E69F00',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
] as const;

const BOX_GEOM = new THREE.BoxGeometry(1, 1, 1);
const BOX_EDGES = new THREE.EdgesGeometry(BOX_GEOM);

const MIN_DIM = 0.8; // Å — 단원자 분자 가시 하한.
const PAD = 1.25; // bbox padding factor (원자 sphere surface 와 분리).

export function MoleculeAccentBox({
  molecule,
}: {
  readonly molecule: Molecule;
}): React.ReactElement | null {
  const ids = useMoleculeStore(selectMoleculeIds);
  const idx = ids.indexOf(molecule.id);
  const color = idx >= 0 ? MOLECULE_PALETTE[idx % MOLECULE_PALETTE.length]! : MOLECULE_PALETTE[0]!;

  const bbox = useMemo(() => computeBBox(molecule), [molecule]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    [color],
  );

  // 1 분자 일때는 시각 구분 불필요.
  if (ids.length <= 1 || idx < 0) return null;

  const [minX, minY, minZ] = bbox.min;
  const [maxX, maxY, maxZ] = bbox.max;
  const sx = Math.max((maxX - minX) * PAD, MIN_DIM);
  const sy = Math.max((maxY - minY) * PAD, MIN_DIM);
  const sz = Math.max((maxZ - minZ) * PAD, MIN_DIM);

  return (
    <lineSegments
      position={[bbox.center[0], bbox.center[1], bbox.center[2]]}
      scale={[sx, sy, sz]}
      geometry={BOX_EDGES}
      material={material}
      renderOrder={998}
    />
  );
}
