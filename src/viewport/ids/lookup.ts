// Phase 08 §5.5 (D1a) — ID ↔ index 번역. Phase 09 가 Phase 07 액션 호출 직전 사용.
import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId, BondId } from '@/chemistry/compounds/ids';

/** 미발견 시 -1 (호출자가 명시 분기). 선형 탐색 (atom 수 < 1000, Phase 14 가 캐시 검토). */
export function atomIdToIndex(molecule: Molecule, atomId: AtomId): number {
  return molecule.atoms.findIndex((a) => a.id === atomId);
}

export function bondIdToIndex(molecule: Molecule, bondId: BondId): number {
  return molecule.bonds.findIndex((b) => b.id === bondId);
}

/** 인덱스 → AtomId. removeAtom 직후 selection 보정용. 범위 밖이면 null. */
export function atomIndexToId(molecule: Molecule, index: number): AtomId | null {
  return molecule.atoms[index]?.id ?? null;
}
