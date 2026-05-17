// Phase 09 §6.4.1 — 순수 도메인 결합 그래프 검색 (R3F/DOM 비의존).
// chemistry 레이어 위치 근거: Phase 06 휴리스틱(§6.7 step6 "기존 결합 있으면
// order 증가")도 동일 로직 필요 → 중복 회피. atom *인덱스* 쌍을 받아 내부에서
// AtomId 로 환산 후 비교 (Bond 는 AtomId 참조, CD1).
import type { Molecule } from '@/chemistry/compounds/types';

/** aIdx/bIdx 두 원자 사이 결합이 존재하는가 (무방향). 범위 밖이면 false. */
export function existsBond(mol: Molecule, aIdx: number, bIdx: number): boolean {
  return findBondIndex(mol, aIdx, bIdx) >= 0;
}

/** aIdx/bIdx 사이 결합의 bonds[] 인덱스. 없거나 인덱스 범위 밖이면 -1. */
export function findBondIndex(mol: Molecule, aIdx: number, bIdx: number): number {
  const a = mol.atoms[aIdx];
  const b = mol.atoms[bIdx];
  if (!a || !b || aIdx === bIdx) return -1;
  return mol.bonds.findIndex(
    (bd) =>
      (bd.aAtomId === a.id && bd.bAtomId === b.id) || (bd.aAtomId === b.id && bd.bAtomId === a.id),
  );
}
