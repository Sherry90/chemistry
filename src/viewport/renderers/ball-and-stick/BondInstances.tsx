// Phase 08 §6.3 — 결합 cylinder 풀 (단일 풀, mid-split 2색 + 차수 평행 변위).
// Phase 14 §5.4 / §6.4 W3-C1 retrofit:
//   - props 에 `lodLevel: LodLevel` + `renderMode: RenderMode` 추가.
//   - lod 변경 시 cached cylinder geometry 로 pool.mesh.geometry reassign (cache 소유 → dispose 금지).
//   - renderMode === 'space-filling' | 'wireframe' 또는 lodLevel === 'line' 인 경우는
//     parent 가 비마운트 (LineBonds 가 대체). 본 컴포넌트는 prop 만 받고 동작.
import type * as React from 'react';
import { useEffect, useMemo, useLayoutEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import { getAtomIdFromIntersection } from '../../ids/picking';
import { selectFromPick } from '../../interactions/usePointerSelect';
import {
  bondPoolRegistry,
  allocBondSlots,
  freeBondSlots,
  setBondMatrix,
} from '../../_shared/poolRegistry';
import {
  bondTransform,
  splitBondTransforms,
  parallelOffsetFactors,
  perpendicularTo,
  type V3,
} from '../geometry/bondTransform';
import { bondSplitColors } from '../../_shared/colors';
import { cylinderGeometryFor } from '../../_shared/lod';
import { BOND_RADIUS_ANGSTROM, BOND_PARALLEL_OFFSET } from '../../_shared/constants';
import type { LodLevel, RenderMode } from '../../_shared/types';

const bondMaterial = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
const _color = new THREE.Color();

export interface BondInstancesProps {
  readonly molecule: Molecule;
  readonly lodLevel: LodLevel;
  readonly renderMode: RenderMode;
  // Phase 15 §6.2 (I3) — exit fade × mount fade 합성 opacity (caller 합성).
  readonly fadeOpacity?: number;
}

export function BondInstances({
  molecule,
  lodLevel,
  renderMode: _renderMode,
  fadeOpacity,
}: BondInstancesProps): React.ReactElement | null {
  // _renderMode — §5.4 spec props 충족용 prefix (mount/unmount 분기는 parent 가 수행).
  const molId = molecule.id;
  const [, bump] = useState(0);

  const atomById = useMemo(() => {
    const m = new Map<AtomId, Atom>();
    for (const a of molecule.atoms) m.set(a.id, a);
    return m;
  }, [molecule]);

  // 부수효과 → useLayoutEffect (useMemo 안 side-effect 금지, advisor 검토 반영).
  // Phase 14: lod 변경 시 cached geometry 로 pool.mesh.geometry swap (dispose 금지 — cache 소유).
  // renderMode 는 §5.4 spec props 충족용으로 받지만, BondInstances 자체 분기에는
  // 영향이 없어 effect deps 에서 제외 (mode toggle 마다 전체 bond 매트릭스 재기입 회피).
  useLayoutEffect(() => {
    const geom = cylinderGeometryFor(lodLevel);
    const pool = bondPoolRegistry.ensure(molId, geom, bondMaterial);
    if (pool.mesh.geometry !== geom) pool.mesh.geometry = geom;
    const live = new Set(molecule.bonds.map((b) => b.id));
    for (const id of [...pool.bondIdToSlots.keys()]) {
      if (!live.has(id)) freeBondSlots(pool, id);
    }
    for (const bond of molecule.bonds) {
      const a = atomById.get(bond.aAtomId);
      const b = atomById.get(bond.bAtomId);
      if (!a || !b) continue;
      const pa: V3 = [a.position.x, a.position.y, a.position.z];
      const pb: V3 = [b.position.x, b.position.y, b.position.z];
      const axis: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const perp = perpendicularTo(axis);
      const factors = parallelOffsetFactors(bond.order);
      const split = bondSplitColors(a.elementNumber, b.elementNumber);
      const cylPerLine = split.single ? 1 : 2;
      const slots = allocBondSlots(pool, bond.id, factors.length * cylPerLine);

      let si = 0;
      for (const f of factors) {
        const d = f * BOND_PARALLEL_OFFSET;
        const ao: V3 = [pa[0] + perp[0] * d, pa[1] + perp[1] * d, pa[2] + perp[2] * d];
        const bo: V3 = [pb[0] + perp[0] * d, pb[1] + perp[1] * d, pb[2] + perp[2] * d];
        if (split.single) {
          const slot = slots[si++]!;
          setBondMatrix(pool, slot, bondTransform(ao, bo, BOND_RADIUS_ANGSTROM));
          pool.mesh.setColorAt(slot, _color.set(split.a));
        } else {
          const [m1, m2] = splitBondTransforms(ao, bo, BOND_RADIUS_ANGSTROM);
          const s1 = slots[si++]!;
          const s2 = slots[si++]!;
          setBondMatrix(pool, s1, m1);
          pool.mesh.setColorAt(s1, _color.set(split.a));
          setBondMatrix(pool, s2, m2);
          pool.mesh.setColorAt(s2, _color.set(split.b));
        }
      }
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
    }
    bump((n) => n + 1);
  }, [molecule, atomById, lodLevel, molId]);

  useEffect(() => {
    return () => bondPoolRegistry.deleteAll(molId);
  }, [molId]);

  // I3 — fadeOpacity 를 bond pool material 에 적용 (pool 마다 cloned, 격리 보장).
  useEffect(() => {
    const pool = bondPoolRegistry.find(molId);
    if (!pool) return;
    const mat = pool.mesh.material as THREE.Material;
    mat.opacity = fadeOpacity ?? 1;
  }, [fadeOpacity, molId, molecule]);

  // I4 — bond click → selection (shift 토글).
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const picked = getAtomIdFromIntersection(e);
    selectFromPick(picked, e.shiftKey);
  }, []);

  const mesh = bondPoolRegistry.find(molId)?.mesh;
  return mesh ? <primitive object={mesh} onPointerDown={onPointerDown} /> : null;
}
