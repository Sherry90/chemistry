import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  atomPoolRegistry,
  bondPoolRegistry,
  allocAtomSlot,
  freeAtomSlot,
  allocBondSlots,
  freeBondSlots,
  INITIAL_CAPACITY,
} from '@/viewport/_shared/poolRegistry';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';

const mol = 'm1' as MoleculeId;
const C = 6 as ElementNumber;
const O = 8 as ElementNumber;
const geom = new THREE.SphereGeometry(1, 4, 4);
const mat = new THREE.MeshBasicMaterial();

beforeEach(() => {
  atomPoolRegistry.clearAll();
  bondPoolRegistry.clearAll();
});
afterEach(() => {
  atomPoolRegistry.clearAll();
  bondPoolRegistry.clearAll();
});

describe('atom pool — alloc/free/grow/tail-swap', () => {
  it('alloc 100 → grow 64→128, used=100', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    expect(pool.capacity).toBe(INITIAL_CAPACITY);
    for (let i = 0; i < 100; i++) allocAtomSlot(pool, `a${i}` as AtomId);
    expect(pool.used).toBe(100);
    expect(pool.capacity).toBe(128);
    expect(pool.mesh.count).toBe(100);
  });

  it('free leaves no holes; slots [0,used) all valid', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    for (let i = 0; i < 20; i++) allocAtomSlot(pool, `a${i}` as AtomId);
    for (const i of [3, 7, 11, 0, 19]) freeAtomSlot(pool, `a${i}` as AtomId);
    expect(pool.used).toBe(15);
    for (let s = 0; s < pool.used; s++) {
      const id = pool.instanceIdToAtomId[s];
      expect(id).toBeDefined();
      expect(pool.atomIdToSlot.get(id!)).toBe(s);
    }
  });

  it('alloc is idempotent for same atomId', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    const s1 = allocAtomSlot(pool, 'x' as AtomId);
    const s2 = allocAtomSlot(pool, 'x' as AtomId);
    expect(s1).toBe(s2);
    expect(pool.used).toBe(1);
  });

  it('deleteAll removes pools for the molecule (HMR stale = 0)', () => {
    atomPoolRegistry.ensure(mol, C, geom, mat);
    atomPoolRegistry.ensure(mol, O, geom, mat);
    expect(atomPoolRegistry.size).toBe(2);
    atomPoolRegistry.deleteAll(mol);
    expect(atomPoolRegistry.size).toBe(0);
    expect(atomPoolRegistry.find(mol, C)).toBeNull();
  });
});

describe('bond pool — multi-slot per bond', () => {
  it('allocBondSlots reserves N contiguous slots; free compacts', () => {
    const pool = bondPoolRegistry.ensure(mol, geom, mat);
    const b1 = allocBondSlots(pool, 'b1' as BondId, 4); // order 2 mid-split
    const b2 = allocBondSlots(pool, 'b2' as BondId, 2);
    expect(b1).toEqual([0, 1, 2, 3]);
    expect(b2).toEqual([4, 5]);
    expect(pool.used).toBe(6);

    freeBondSlots(pool, 'b1' as BondId);
    expect(pool.used).toBe(2);
    // b2 's slots remapped, still resolvable
    const slots = pool.bondIdToSlots.get('b2' as BondId)!;
    for (const s of slots) expect(pool.instanceIdToBondId[s]).toBe('b2');
  });

  it('re-alloc same bond frees previous slots first', () => {
    const pool = bondPoolRegistry.ensure(mol, geom, mat);
    allocBondSlots(pool, 'b' as BondId, 2);
    allocBondSlots(pool, 'b' as BondId, 6); // setBondOrder change
    expect(pool.used).toBe(6);
    expect(pool.bondIdToSlots.get('b' as BondId)!.length).toBe(6);
  });
});

// Phase 15 §6.2 (I3) — pool 마다 material clone 격리 검증. 단일 분자 fade 가
// 다른 분자에 opacity 누출되지 않도록 ensure() 가 material.clone() + transparent=true.
describe('I3 — material clone isolation', () => {
  it('각 atom pool 은 입력 material 과 다른 인스턴스를 보유 (clone)', () => {
    const m1 = 'mol1' as MoleculeId;
    const m2 = 'mol2' as MoleculeId;
    const shared = new THREE.MeshBasicMaterial();
    const p1 = atomPoolRegistry.ensure(m1, C, geom, shared);
    const p2 = atomPoolRegistry.ensure(m2, C, geom, shared);
    expect(p1.mesh.material).not.toBe(shared);
    expect(p2.mesh.material).not.toBe(shared);
    expect(p1.mesh.material).not.toBe(p2.mesh.material);
  });

  it('atom pool material 의 opacity 변경이 다른 분자에 누출되지 않음', () => {
    const m1 = 'mol1' as MoleculeId;
    const m2 = 'mol2' as MoleculeId;
    const shared = new THREE.MeshBasicMaterial();
    const p1 = atomPoolRegistry.ensure(m1, C, geom, shared);
    const p2 = atomPoolRegistry.ensure(m2, C, geom, shared);
    (p1.mesh.material as THREE.Material).opacity = 0.3;
    expect((p2.mesh.material as THREE.Material).opacity).toBe(1);
    expect((shared as THREE.Material).opacity).toBe(1);
  });

  it('atom pool material 은 transparent=true (clone 시 강제)', () => {
    const m1 = 'mol1' as MoleculeId;
    const p1 = atomPoolRegistry.ensure(m1, C, geom, new THREE.MeshBasicMaterial());
    expect((p1.mesh.material as THREE.Material).transparent).toBe(true);
  });

  it('bond pool material 도 동일하게 clone+transparent', () => {
    const m1 = 'mol1' as MoleculeId;
    const m2 = 'mol2' as MoleculeId;
    const shared = new THREE.MeshBasicMaterial();
    const p1 = bondPoolRegistry.ensure(m1, geom, shared);
    const p2 = bondPoolRegistry.ensure(m2, geom, shared);
    expect(p1.mesh.material).not.toBe(shared);
    expect(p1.mesh.material).not.toBe(p2.mesh.material);
    expect((p1.mesh.material as THREE.Material).transparent).toBe(true);
    (p1.mesh.material as THREE.Material).opacity = 0.5;
    expect((p2.mesh.material as THREE.Material).opacity).toBe(1);
  });
});
