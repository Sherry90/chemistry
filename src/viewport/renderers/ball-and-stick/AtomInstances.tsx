// Phase 08 §6.2 — 원소별 InstancedMesh 풀. 슬롯 운영은 poolRegistry (tested §8.7).
import type * as React from 'react';
import { useEffect, useMemo, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { ElementNumber } from '@/chemistry/elements/types';
import {
  atomPoolRegistry,
  allocAtomSlot,
  freeAtomSlot,
  setAtomMatrix,
} from '../../_shared/poolRegistry';
import { atomDisplayRadius } from '../../_shared/radii';
import { cpkColorOf } from '../../_shared/colors';
import { sphereGeometryFor } from '../../_shared/lod';
import type { LodLevel } from '../../_shared/types';
import type { ThreeEvent } from '@react-three/fiber';

const materialCache = new Map<ElementNumber, THREE.MeshStandardMaterial>();
function materialFor(el: ElementNumber): THREE.MeshStandardMaterial {
  let m = materialCache.get(el);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cpkColorOf(el), roughness: 0.45, metalness: 0 });
    materialCache.set(el, m);
  }
  return m;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export interface AtomInstancesProps {
  readonly molecule: Molecule;
  readonly lod: LodLevel;
  readonly onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  readonly onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export function AtomInstances({
  molecule,
  lod,
  onPointerOver,
  onPointerOut,
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
  useLayoutEffect(() => {
    const geom = sphereGeometryFor(lod);
    for (const [el, atoms] of byElement) {
      const pool = atomPoolRegistry.ensure(molId, el, geom, materialFor(el));
      const live = new Set(atoms.map((a) => a.id));
      for (const id of [...pool.atomIdToSlot.keys()]) {
        if (!live.has(id)) freeAtomSlot(pool, id);
      }
      const r = atomDisplayRadius(el);
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
  }, [byElement, lod, molId]);

  useEffect(() => {
    return () => atomPoolRegistry.deleteAll(molId);
  }, [molId]);

  const meshes = [...byElement.keys()].map((el) => atomPoolRegistry.find(molId, el)?.mesh);

  return (
    <group>
      {meshes.map((mesh, i) =>
        mesh ? (
          <primitive
            key={i}
            object={mesh}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          />
        ) : null,
      )}
    </group>
  );
}
