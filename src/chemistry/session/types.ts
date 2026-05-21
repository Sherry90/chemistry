// Phase 13 §4.3 / §4.4 — 세션 스키마는 chemistry 계층 정의 (CD6).
// stores 가 import 하므로 src/io 가 아닌 chemistry 계층에 둔다.
import type { MoleculeId, SerializedAtom } from '@/chemistry/compounds/ids';
import type { Condition } from '@/chemistry/reactions/types';
import type { StereoAnnotations } from '@/types/stereo';

export type AtomSnapshot = SerializedAtom & { readonly isotope?: number | null };

export interface BondSnapshot {
  readonly aAtomIndex: number;
  readonly bAtomIndex: number;
  readonly order: 1 | 2 | 3 | 'aromatic';
}

export type MoleculeOrigin =
  | { readonly kind: 'user-input' }
  | { readonly kind: 'pubchem'; readonly cid: number; readonly name?: string };

export interface MoleculeSnapshot {
  readonly id: MoleculeId;
  readonly canonicalSmiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
  readonly totalCharge: number;
  readonly spinMultiplicity: number;
  readonly atoms: ReadonlyArray<AtomSnapshot>;
  readonly bonds: ReadonlyArray<BondSnapshot>;
  readonly stereo: StereoAnnotations;
  readonly origin: MoleculeOrigin;
}

export interface SerializedSelection {
  readonly atomIds: ReadonlyArray<{ readonly moleculeIndex: number; readonly atomIndex: number }>;
  readonly bondIds: ReadonlyArray<{ readonly moleculeIndex: number; readonly bondIndex: number }>;
}

export interface SessionFile {
  readonly schemaVersion: 1;
  readonly app: { readonly name: 'chemistry-platform'; readonly version: string };
  readonly exportedAt: string;
  readonly molecules: ReadonlyArray<MoleculeSnapshot>;
  readonly activeMoleculeId: MoleculeId | null;
  readonly condition: Condition;
  readonly selection: SerializedSelection;
  readonly viewport: {
    readonly showAtomLabels: boolean;
    readonly backgroundOverride: 'theme' | 'light' | 'dark';
  };
}
