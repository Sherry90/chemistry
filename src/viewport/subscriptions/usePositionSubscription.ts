// Phase 08 §5.6 / §6.5.1 (D8) — 좌표 변화 구독 → InstancedMesh.setMatrixAt 직접 갱신.
// React 리렌더 0회. unmount 시 자동 unsub (P5).
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useMoleculeStore } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { atomPoolRegistry, setAtomMatrix } from '../_shared/poolRegistry';
import { atomDisplayRadius } from '../_shared/radii';

export interface PositionSubscriptionHandle {
  readonly suspend: () => void;
  readonly resume: () => void;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export function useAtomMatrixSubscription(molId: MoleculeId): PositionSubscriptionHandle {
  const suspendedRef = useRef(false);

  useEffect(() => {
    const unsub = useMoleculeStore.subscribe(
      (st) => st.molecules[molId],
      (mol, prevMol) => {
        if (suspendedRef.current) return;
        if (!mol || !prevMol || mol === prevMol) return;
        // immer 구조적 공유: 변경 안 된 atom 은 동일 position 참조 (advisor).
        for (const a of mol.atoms) {
          const prev = prevMol.atoms.find((p) => p.id === a.id);
          if (prev && prev.position !== a.position) {
            const pool = atomPoolRegistry.find(molId, a.elementNumber);
            if (pool) {
              const r = atomDisplayRadius(a.elementNumber);
              _p.set(a.position.x, a.position.y, a.position.z);
              _q.identity();
              _s.set(r, r, r);
              _m.compose(_p, _q, _s);
              setAtomMatrix(pool, a.id, _m);
            }
          }
        }
      },
      { fireImmediately: false, equalityFn: Object.is },
    );
    return () => unsub(); // P5
  }, [molId]);

  return useMemo<PositionSubscriptionHandle>(
    () => ({
      suspend: () => {
        suspendedRef.current = true;
      },
      resume: () => {
        suspendedRef.current = false;
      },
    }),
    [],
  );
}
