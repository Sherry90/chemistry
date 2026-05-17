import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  atomPoolRegistry,
  bondPoolRegistry,
  allocAtomSlot,
  freeAtomSlot,
  allocBondSlots,
} from '@/viewport/_shared/poolRegistry';
import { getAtomIdFromIntersection } from '@/viewport/ids/picking';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';

const mol = 'm1' as MoleculeId;
const C = 6 as ElementNumber;
const geom = new THREE.SphereGeometry(1, 4, 4);
const mat = new THREE.MeshBasicMaterial();

const intersection = (object: THREE.Object3D, instanceId: number | undefined) =>
  ({ object, instanceId }) as unknown as THREE.Intersection;

beforeEach(() => {
  atomPoolRegistry.clearAll();
  bondPoolRegistry.clearAll();
});

describe('getAtomIdFromIntersection', () => {
  it('maps atomPool slot → atomId', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    allocAtomSlot(pool, 'atomA' as AtomId);
    const r = getAtomIdFromIntersection(intersection(pool.mesh, 0));
    expect(r).toEqual({ kind: 'atom', molId: mol, atomId: 'atomA' });
  });

  it('maps bondPool slot → bondId', () => {
    const pool = bondPoolRegistry.ensure(mol, geom, mat);
    allocBondSlots(pool, 'bondX' as BondId, 2);
    const r = getAtomIdFromIntersection(intersection(pool.mesh, 1));
    expect(r).toEqual({ kind: 'bond', molId: mol, bondId: 'bondX' });
  });

  it('non-pool userData → null', () => {
    const obj = new THREE.Mesh(geom, mat);
    expect(getAtomIdFromIntersection(intersection(obj, 0))).toBeNull();
  });

  it('instanceId undefined → null', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    allocAtomSlot(pool, 'a' as AtomId);
    expect(getAtomIdFromIntersection(intersection(pool.mesh, undefined))).toBeNull();
  });

  it('freed slot (no atomId) → null; tail-swap keeps survivors pickable', () => {
    const pool = atomPoolRegistry.ensure(mol, C, geom, mat);
    allocAtomSlot(pool, 'a0' as AtomId);
    allocAtomSlot(pool, 'a1' as AtomId);
    allocAtomSlot(pool, 'a2' as AtomId);
    freeAtomSlot(pool, 'a0' as AtomId); // a2 tail-swaps into slot 0
    expect(getAtomIdFromIntersection(intersection(pool.mesh, 0))).toEqual({
      kind: 'atom',
      molId: mol,
      atomId: 'a2',
    });
    expect(getAtomIdFromIntersection(intersection(pool.mesh, 2))).toBeNull(); // beyond used
  });
});
