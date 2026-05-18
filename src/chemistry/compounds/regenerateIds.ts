// Phase 11 §6.12 / CD1·CD6 — molecule/atom/bond stable ID 일괄 재발급 순수 모듈.
// 본 Phase(11)가 신설, phase-12/13 공용 import (doc §12.1: "phase-12 가 신설"
// 명세이나 phase-11 이 먼저 필요 → phase-11 작성, phase-12/13 재사용).
// ReactionResult.products 의 분자 ID 가 reactionStore 안에서 임시일 수 있어
// 작업공간 적재 시 재할당이 안전.
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { AtomId, MoleculeId } from '@/chemistry/compounds/ids';
import { createAtomId, createBondId } from '@/chemistry/compounds/ids';

/**
 * `m` 의 사본을 만들되 molecule id = `newId`, 모든 atom/bond 의 stable ID 를
 * 새로 발급하고 bond 의 atom 참조를 재매핑. 순수 — 입력 불변.
 */
export function withRegeneratedIds(m: Molecule, newId: MoleculeId): Molecule {
  const atomIdMap = new Map<AtomId, AtomId>();
  const atoms: Atom[] = m.atoms.map((a) => {
    const fresh = createAtomId();
    atomIdMap.set(a.id, fresh);
    return { ...a, id: fresh };
  });
  const bonds: Bond[] = m.bonds.map((b) => ({
    ...b,
    id: createBondId(),
    aAtomId: atomIdMap.get(b.aAtomId) ?? b.aAtomId,
    bAtomId: atomIdMap.get(b.bAtomId) ?? b.bAtomId,
  }));
  return { ...m, id: newId, atoms, bonds };
}
