// Phase 08 §6.2 (D9+D9a+P4) — InstancedMesh 풀 레지스트리 (모듈-레벨, viewport 내부 전용).
// tail-only allocation + tail-swap on remove. free-list 없음. THREE.InstancedMesh 는
// 생성 시 WebGL 컨텍스트 불요 (instanceMatrix = Float32Array) → jsdom 단위 테스트 가능.
import * as THREE from 'three';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';
import type {
  AtomInstancePool,
  AtomPoolUserData,
  BondInstancePool,
  BondPoolUserData,
} from './types';

export const INITIAL_CAPACITY = 64;

const _tmp = new THREE.Matrix4();
const atomKey = (molId: MoleculeId, element: ElementNumber) => `${molId}::${element}`;

const atomPools = new Map<string, AtomInstancePool>();
const bondPools = new Map<MoleculeId, BondInstancePool>();

// ── Atom pool ────────────────────────────────────────────────────────────
export const atomPoolRegistry = {
  ensure(
    molId: MoleculeId,
    element: ElementNumber,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ): AtomInstancePool {
    const k = atomKey(molId, element);
    let p = atomPools.get(k);
    if (!p) {
      const mesh = new THREE.InstancedMesh(geometry, material, INITIAL_CAPACITY);
      mesh.count = 0;
      mesh.userData = { kind: 'atomPool', element, molId } satisfies AtomPoolUserData;
      p = {
        element,
        molId,
        mesh,
        instanceIdToAtomId: [],
        atomIdToSlot: new Map(),
        capacity: INITIAL_CAPACITY,
        used: 0,
      };
      atomPools.set(k, p);
    }
    return p;
  },
  find(molId: MoleculeId, element: ElementNumber): AtomInstancePool | null {
    return atomPools.get(atomKey(molId, element)) ?? null;
  },
  deleteAll(molId: MoleculeId): void {
    for (const [k, p] of atomPools) {
      if (p.molId === molId) {
        p.mesh.dispose();
        atomPools.delete(k);
      }
    }
  },
  clearAll(): void {
    atomPools.clear();
  },
  get size(): number {
    return atomPools.size;
  },
};

function growAtomPool(pool: AtomInstancePool, newCapacity: number): void {
  const old = pool.mesh;
  const next = new THREE.InstancedMesh(old.geometry, old.material, newCapacity);
  for (let s = 0; s < pool.used; s++) {
    old.getMatrixAt(s, _tmp);
    next.setMatrixAt(s, _tmp);
  }
  next.count = pool.used;
  next.userData = old.userData;
  old.dispose();
  pool.mesh = next;
  pool.capacity = newCapacity;
}

export function allocAtomSlot(pool: AtomInstancePool, atomId: AtomId): number {
  const ex = pool.atomIdToSlot.get(atomId);
  if (ex !== undefined) return ex; // 멱등 (§6.2.2)
  if (pool.used === pool.capacity) growAtomPool(pool, pool.capacity * 2);
  const slot = pool.used;
  pool.used += 1;
  pool.instanceIdToAtomId[slot] = atomId;
  pool.atomIdToSlot.set(atomId, slot);
  pool.mesh.count = pool.used;
  return slot;
}

export function freeAtomSlot(pool: AtomInstancePool, atomId: AtomId): void {
  const slot = pool.atomIdToSlot.get(atomId);
  if (slot === undefined) return;
  const last = pool.used - 1;
  if (slot < last) {
    pool.mesh.getMatrixAt(last, _tmp);
    pool.mesh.setMatrixAt(slot, _tmp);
    const moved = pool.instanceIdToAtomId[last]!;
    pool.instanceIdToAtomId[slot] = moved;
    pool.atomIdToSlot.set(moved, slot);
  }
  pool.instanceIdToAtomId[last] = undefined;
  pool.atomIdToSlot.delete(atomId);
  pool.used = last;
  pool.mesh.count = pool.used;
  pool.mesh.instanceMatrix.needsUpdate = true;
}

export function setAtomMatrix(
  pool: AtomInstancePool,
  atomId: AtomId,
  matrix: THREE.Matrix4,
): number {
  let slot = pool.atomIdToSlot.get(atomId);
  if (slot === undefined) slot = allocAtomSlot(pool, atomId);
  pool.mesh.setMatrixAt(slot, matrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  return slot;
}

// ── Bond pool (cylinder 슬롯 단위; 1 BondId → 2~6 슬롯) ────────────────────
export const bondPoolRegistry = {
  ensure(
    molId: MoleculeId,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ): BondInstancePool {
    let p = bondPools.get(molId);
    if (!p) {
      const mesh = new THREE.InstancedMesh(geometry, material, INITIAL_CAPACITY);
      mesh.count = 0;
      mesh.userData = { kind: 'bondPool', molId } satisfies BondPoolUserData;
      p = {
        molId,
        mesh,
        instanceIdToBondId: [],
        bondIdToSlots: new Map(),
        capacity: INITIAL_CAPACITY,
        used: 0,
      };
      bondPools.set(molId, p);
    }
    return p;
  },
  find(molId: MoleculeId): BondInstancePool | null {
    return bondPools.get(molId) ?? null;
  },
  deleteAll(molId: MoleculeId): void {
    const p = bondPools.get(molId);
    if (p) {
      p.mesh.dispose();
      bondPools.delete(molId);
    }
  },
  clearAll(): void {
    bondPools.clear();
  },
  get size(): number {
    return bondPools.size;
  },
};

function growBondPool(pool: BondInstancePool, newCapacity: number): void {
  const old = pool.mesh;
  const next = new THREE.InstancedMesh(old.geometry, old.material, newCapacity);
  for (let s = 0; s < pool.used; s++) {
    old.getMatrixAt(s, _tmp);
    next.setMatrixAt(s, _tmp);
  }
  next.count = pool.used;
  next.userData = old.userData;
  old.dispose();
  pool.mesh = next;
  pool.capacity = newCapacity;
}

/** bondId 에 `count` 개 연속 cylinder 슬롯 할당 (재할당 시 기존 해제 후). */
export function allocBondSlots(
  pool: BondInstancePool,
  bondId: BondId,
  count: number,
): ReadonlyArray<number> {
  if (pool.bondIdToSlots.has(bondId)) freeBondSlots(pool, bondId);
  while (pool.used + count > pool.capacity) growBondPool(pool, pool.capacity * 2);
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    const slot = pool.used + i;
    pool.instanceIdToBondId[slot] = bondId;
    slots.push(slot);
  }
  pool.used += count;
  pool.bondIdToSlots.set(bondId, slots);
  pool.mesh.count = pool.used;
  return slots;
}

export function freeBondSlots(pool: BondInstancePool, bondId: BondId): void {
  const slots = pool.bondIdToSlots.get(bondId);
  if (!slots) return;
  // 내림차순 tail-swap (각 슬롯을 개별 압축).
  for (const slot of [...slots].sort((a, b) => b - a)) {
    const last = pool.used - 1;
    if (slot < last) {
      pool.mesh.getMatrixAt(last, _tmp);
      pool.mesh.setMatrixAt(slot, _tmp);
      const movedBond = pool.instanceIdToBondId[last]!;
      pool.instanceIdToBondId[slot] = movedBond;
      const ms = pool.bondIdToSlots.get(movedBond);
      if (ms) {
        pool.bondIdToSlots.set(
          movedBond,
          ms.map((s) => (s === last ? slot : s)),
        );
      }
    }
    pool.instanceIdToBondId[last] = undefined;
    pool.used -= 1;
  }
  pool.bondIdToSlots.delete(bondId);
  pool.mesh.count = pool.used;
  pool.mesh.instanceMatrix.needsUpdate = true;
}

export function setBondMatrix(pool: BondInstancePool, slot: number, matrix: THREE.Matrix4): void {
  pool.mesh.setMatrixAt(slot, matrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
}
