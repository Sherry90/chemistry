import type { AtomId, BondId } from '@/chemistry/compounds/ids';

export type BondOrder = 1 | 2 | 3 | 'aromatic'; // architecture.md §3.10 동결

export interface Bond {
  readonly id: BondId;
  readonly aAtomId: AtomId; // 참조 대상 Atom.id (배열 인덱스 아님)
  readonly bAtomId: AtomId;
  readonly order: BondOrder;
  // TODO: Phase 03 — 기본 결합 길이/각은 RDKit embed 결과에서 파생
}
