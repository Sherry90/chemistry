import type { StereoAnnotations, AtomStereoTag, BondStereoTag } from '@/types/stereo';

export type { StereoAnnotations, AtomStereoTag, BondStereoTag };

export type InputKind = 'smiles' | 'inchi' | 'formula';

export interface InputSource {
  readonly kind: InputKind;
  readonly raw: string;
  readonly normalized: string;
}

export interface ParsedAtom {
  readonly index: number;
  readonly elementNumber: number;
  readonly formalCharge: number;
  readonly isotope: number | null;
  readonly implicitHCount: number;
  readonly aromaticFlag: boolean;
}

export interface ParsedBond {
  readonly beginAtomIdx: number;
  readonly endAtomIdx: number;
  readonly order: 1 | 2 | 3 | 'aromatic';
  readonly stereoTag: BondStereoTag;
}

export interface ParsedMol {
  readonly source: InputSource;
  readonly canonicalSmiles: string;
  readonly formula: string;
  readonly molecularWeight: number;
  readonly totalCharge: number;
  readonly radicalElectrons: number;
  readonly atoms: ReadonlyArray<ParsedAtom>;
  readonly bonds: ReadonlyArray<ParsedBond>;
  readonly stereo: StereoAnnotations;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
}

export type RdkitInitErrorCode =
  | 'ScriptLoadFailed'
  | 'WasmInstantiateFailed'
  | 'InitTimeout'
  | 'UnsupportedEnvironment'
  | 'InternalError';

export interface RdkitInitError {
  readonly code: RdkitInitErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type RdkitStatus =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading'; readonly progress?: number }
  | { readonly phase: 'ready' }
  | { readonly phase: 'error'; readonly error: RdkitInitError };
