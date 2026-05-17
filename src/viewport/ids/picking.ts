// Phase 08 §5.8 / §6.2.4 (D9a) — intersection → 도메인 식별자 (Phase 09 raycast 후크).
import type * as THREE from 'three';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';
import { atomPoolRegistry, bondPoolRegistry } from '../_shared/poolRegistry';

type PoolUserData = {
  readonly kind?: 'atomPool' | 'bondPool';
  readonly element?: ElementNumber;
  readonly molId?: MoleculeId;
};

export type PickedTarget =
  | { readonly kind: 'atom'; readonly molId: MoleculeId; readonly atomId: AtomId }
  | { readonly kind: 'bond'; readonly molId: MoleculeId; readonly bondId: BondId };

export function getAtomIdFromIntersection(it: THREE.Intersection): PickedTarget | null {
  const ud = it.object.userData as PoolUserData;
  if (it.instanceId == null) return null;

  if (ud.kind === 'atomPool' && ud.molId != null && ud.element != null) {
    const pool = atomPoolRegistry.find(ud.molId, ud.element);
    const atomId = pool?.instanceIdToAtomId[it.instanceId];
    return atomId ? { kind: 'atom', molId: ud.molId, atomId } : null;
  }
  if (ud.kind === 'bondPool' && ud.molId != null) {
    const pool = bondPoolRegistry.find(ud.molId);
    const bondId = pool?.instanceIdToBondId[it.instanceId];
    return bondId ? { kind: 'bond', molId: ud.molId, bondId } : null;
  }
  return null;
}
