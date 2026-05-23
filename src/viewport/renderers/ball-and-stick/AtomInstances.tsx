// Phase 08 §6.2 — 원소별 InstancedMesh 풀. 슬롯 운영은 poolRegistry (tested §8.7).
// Phase 14 §5.4 / §6.4 W3-C1 retrofit:
//   - props 에 `lodLevel: LodLevel` + `renderMode: RenderMode` 추가 (caller 가 주입).
//   - lod 변경 시 cached geometry 를 pool.mesh.geometry 로 reassign (cache 가 lifetime 소유 → dispose 금지).
//   - renderMode === 'space-filling' 시 atomRadius = vdW radius × PM_TO_ÅNGSTROM × SPACE_FILLING_SCALE.
//     vdwRadiusPm === null fallback → covalent radius × ATOM_RADIUS_SCALE.
//   - renderMode === 'wireframe' | 'stick' 비마운트(parent 조건 렌더) — 본 컴포넌트는 prop 만 받고 동작.
import type * as React from 'react';
import { useEffect, useMemo, useLayoutEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { ElementNumber } from '@/chemistry/elements/types';
import { getElement } from '@/chemistry/elements';
import {
  atomPoolRegistry,
  allocAtomSlot,
  freeAtomSlot,
  setAtomMatrix,
} from '../../_shared/poolRegistry';
import { atomDisplayRadius, covalentRadiusAngstrom } from '../../_shared/radii';
import { cpkColorOf } from '../../_shared/colors';
import { sphereGeometryFor } from '../../_shared/lod';
import { ATOM_RADIUS_SCALE } from '../../_shared/constants';
import type { LodLevel, RenderMode } from '../../_shared/types';
import type { ThreeEvent } from '@react-three/fiber';
import type { DragController } from '../../interactions/usePointerDrag';
import { getAtomIdFromIntersection } from '../../ids/picking';
import { selectFromPick } from '../../interactions/usePointerSelect';

const PM_TO_ANGSTROM = 0.01;
/** Phase 14 §6.4 — space-filling: vdW 반지름 그대로. */
const SPACE_FILLING_SCALE = 1.0;

const materialCache = new Map<ElementNumber, THREE.MeshStandardMaterial>();
function materialFor(el: ElementNumber): THREE.MeshStandardMaterial {
  let m = materialCache.get(el);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cpkColorOf(el), roughness: 0.45, metalness: 0 });
    materialCache.set(el, m);
  }
  return m;
}

/**
 * 원자 반지름 (Å) — renderMode 별:
 *   - 'space-filling' → vdW (pm → Å × SPACE_FILLING_SCALE). null fallback: covalent × ATOM_RADIUS_SCALE.
 *   - 그 외 → 기존 ball-and-stick covalent × ATOM_RADIUS_SCALE.
 */
function radiusFor(el: ElementNumber, renderMode: RenderMode): number {
  if (renderMode === 'space-filling') {
    const vdw = getElement(el).vdwRadiusPm;
    if (vdw != null) return vdw * PM_TO_ANGSTROM * SPACE_FILLING_SCALE;
    // fallback — 데이터에 vdW 가 없는 원소(예: He 등 일부)일 때 ball-stick 비율로 표시.
    return covalentRadiusAngstrom(el) * ATOM_RADIUS_SCALE;
  }
  return atomDisplayRadius(el);
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export interface AtomInstancesProps {
  readonly molecule: Molecule;
  readonly lodLevel: LodLevel;
  readonly renderMode: RenderMode;
  readonly onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  readonly onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  // Phase 15 §6.2 (I3) — exit fade × (mount fade) 합성 opacity (caller 합성).
  // cloned material 이 pool 마다 격리되어 다른 분자에 영향 없음 (poolRegistry).
  readonly fadeOpacity?: number;
  // Phase 15 §6.3 (I4) — atom drag/select 컨트롤러 (MoleculeGroup 제공). undef 시
  // 단독 마운트(테스트 등) 폴백 — pointer event 만 그대로 hover 핸들러로 전달.
  readonly dragController?: DragController;
}

export function AtomInstances({
  molecule,
  lodLevel,
  renderMode,
  onPointerOver,
  onPointerOut,
  fadeOpacity,
  dragController,
}: AtomInstancesProps): React.ReactElement {
  const molId = molecule.id;
  const [, bump] = useState(0);

  const byElement = useMemo(() => {
    const map = new Map<ElementNumber, Atom[]>();
    for (const a of molecule.atoms) {
      const arr = map.get(a.elementNumber);
      if (arr) arr.push(a);
      else map.set(a.elementNumber, [a]);
    }
    return map;
  }, [molecule]);

  // 풀 동기화는 *부수효과* — useLayoutEffect (useMemo 안에서 side-effect 금지: React
  // StrictMode 이중 호출 / memo discard 시 풀 불일치. advisor 검토 반영). 동기화 후
  // bump 으로 1회 리렌더 → 채워진 registry mesh 렌더.
  //
  // Phase 14: deps 에 lodLevel + renderMode 모두. lodLevel 변경 시 cached geometry 로
  // pool.mesh.geometry 를 swap (cache 가 lifetime 소유 → 여기서 dispose 금지).
  useLayoutEffect(() => {
    const geom = sphereGeometryFor(lodLevel);
    for (const [el, atoms] of byElement) {
      const pool = atomPoolRegistry.ensure(molId, el, geom, materialFor(el));
      // lod 변경 시 ensure 는 첫 생성에만 geometry 를 쓰므로 명시 reassign 필요.
      if (pool.mesh.geometry !== geom) pool.mesh.geometry = geom;
      const live = new Set(atoms.map((a) => a.id));
      for (const id of [...pool.atomIdToSlot.keys()]) {
        if (!live.has(id)) freeAtomSlot(pool, id);
      }
      const r = radiusFor(el, renderMode);
      _s.set(r, r, r);
      _q.identity();
      for (const a of atoms) {
        allocAtomSlot(pool, a.id);
        _p.set(a.position.x, a.position.y, a.position.z);
        _m.compose(_p, _q, _s);
        setAtomMatrix(pool, a.id, _m);
      }
    }
    bump((n) => n + 1);
  }, [byElement, lodLevel, renderMode, molId]);

  useEffect(() => {
    return () => atomPoolRegistry.deleteAll(molId);
  }, [molId]);

  // I3 — fadeOpacity 를 분자의 모든 element pool material 에 적용. pool 마다
  // material 이 clone 되어 있어 (poolRegistry.ensure) 다른 분자에 누출되지 않음.
  // layout effect 후에 실행되도록 useEffect (pool ensure 가 마운트 사이클에 선행).
  useEffect(() => {
    const op = fadeOpacity ?? 1;
    for (const el of byElement.keys()) {
      const pool = atomPoolRegistry.find(molId, el);
      if (!pool) continue;
      const mat = pool.mesh.material as THREE.Material;
      mat.opacity = op;
    }
  }, [byElement, fadeOpacity, molId]);

  const meshes = [...byElement.keys()].map((el) => atomPoolRegistry.find(molId, el)?.mesh);

  // I4 — drag begin: 픽된 atom 에 대해 컨트롤러에 위임 (start 시 select 도 갱신 — D6).
  // onPointerDown: select (shift 토글) + drag begin. Window 리스너로 move/up 캡쳐
  // (R3F primitive 의 onPointerMove 는 hover 와 분리하기 어려움 — 명세 §6.3 D4 권장).
  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const picked = getAtomIdFromIntersection(e);
      selectFromPick(picked, e.shiftKey);
      if (!picked || picked.kind !== 'atom') return;
      if (!dragController) return;
      const began = dragController.onPointerDown(picked, e.clientX, e.clientY);
      if (!began) return;
      const onMove = (ev: PointerEvent): void =>
        dragController.onPointerMove(ev.clientX, ev.clientY);
      const onUp = (): void => {
        dragController.onPointerUp();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
      const onCancel = (): void => {
        dragController.onPointerCancel();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    },
    [dragController],
  );

  return (
    <group>
      {meshes.map((mesh, i) =>
        mesh ? (
          <primitive
            key={i}
            object={mesh}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            onPointerDown={onPointerDown}
          />
        ) : null,
      )}
    </group>
  );
}
