import type { Vec3 } from '@/types/geometry';
import type { ElementNumber } from '@/chemistry/elements/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { StereoAnnotations } from '@/types/stereo';
import type { CompoundCategory } from './categories';

export interface Atom {
  readonly elementNumber: ElementNumber;
  readonly position: Vec3;
  readonly formalCharge: number;
  readonly implicitHCount: number;
  // TODO: Phase 11 - 동위원소 라벨 표시 요구 시 'readonly isotope?: number | null;' 추가 (phase-03 §4.5 동위원소 정책)
}

export interface Molecule {
  readonly id: string;
  readonly atoms: ReadonlyArray<Atom>;
  readonly bonds: ReadonlyArray<Bond>;
  readonly totalCharge: number;
  readonly canonicalSmiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
  readonly stereo: StereoAnnotations;
  readonly spinMultiplicity: number;
}

export type PhysicalState = 'solid' | 'liquid' | 'gas' | 'aqueous' | 'unknown';
export type CoordinateSource = 'pubchem-3d' | 'rdkit-etkdg';

export interface CompoundProperties {
  readonly meltingPointK: number | null;
  readonly boilingPointK: number | null;
  readonly densityGPerCm3: number | null;
  readonly standardState: PhysicalState;
  readonly waterSolubility: 'insoluble' | 'slightly' | 'soluble' | 'miscible' | 'unknown';
  readonly logP: number | null;
}

export interface Compound {
  readonly cid: number | null;
  readonly name: { readonly ko: string | null; readonly en: string };
  readonly molecularFormula: string;
  readonly molecularWeight: number;
  readonly smiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
  readonly iupacName: string | null;
  readonly synonyms: ReadonlyArray<string>;
  readonly category: CompoundCategory;
  readonly priority: number;
  readonly properties: CompoundProperties;
  readonly coordinateSource: CoordinateSource | null;
  readonly defaultMolecule: Molecule | null;
}
