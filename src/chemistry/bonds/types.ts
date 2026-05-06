export type BondOrder = 1 | 2 | 3 | 'aromatic';

export interface Bond {
  readonly aAtomId: number;
  readonly bAtomId: number;
  readonly order: BondOrder;
  // TODO: Phase 03 — 기본 결합 길이/각은 RDKit embed 결과에서 파생
}
