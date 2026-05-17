// Phase 08 §5.10 — viewport 내부 조합 selector (Phase 07 selector 위, 신규 store selector 없음).
import type { MoleculeStoreState } from '@/stores';
import type { Molecule } from '@/chemistry/compounds/types';

export const selectAtomCountAcrossAll = (s: MoleculeStoreState): number =>
  s.ids.reduce((acc, id) => acc + (s.molecules[id]?.atoms.length ?? 0), 0);

/** noUncheckedIndexedAccess: guard 필수 (advisor). 분자 추가/삭제 시에만 새 배열. */
export const selectMoleculesArray = (s: MoleculeStoreState): ReadonlyArray<Molecule> =>
  s.ids.map((id) => s.molecules[id]).filter((m): m is Molecule => Boolean(m));
