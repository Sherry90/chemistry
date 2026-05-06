import type { Compound } from '@/chemistry/compounds/types';
import type { CompoundCategory } from '@/chemistry/compounds/categories';
import type { PhysicalState } from '@/chemistry/compounds/types';

export const NORMALIZE_SCHEMA_VERSION = 1;

export interface PubchemProperties {
  readonly CID: number;
  readonly MolecularFormula: string;
  readonly MolecularWeight: number;
  readonly CanonicalSMILES: string;
  readonly IsomericSMILES?: string;
  readonly InChI?: string;
  readonly InChIKey?: string;
  readonly IUPACName?: string;
  readonly XLogP?: number;
}

export interface PubchemSynonymList {
  readonly CID: number;
  readonly Synonym?: ReadonlyArray<string>;
}

export interface PhysicalCurationEntry {
  readonly inchiKey: string;
  readonly meltingPointK: number | null;
  readonly boilingPointK: number | null;
  readonly densityGPerCm3: number | null;
  readonly standardState: PhysicalState;
  readonly waterSolubility: 'insoluble' | 'slightly' | 'soluble' | 'miscible' | 'unknown';
}

export interface NormalizeInput {
  readonly props: PubchemProperties;
  readonly synonyms: ReadonlyArray<string>;
  readonly nameKo: string | null;
  readonly category: CompoundCategory;
  readonly priority: number;
  readonly physical: PhysicalCurationEntry | null;
  readonly canonicalSmiles: string;
  readonly inchi: string | null;
  readonly inchiKey: string | null;
}

export function normalizeSynonyms(raw: ReadonlyArray<string>): ReadonlyArray<string> {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      result.push(t);
      if (result.length >= 5) break;
    }
  }
  return result;
}

export function normalizeMolecularWeight(raw: number | string): number {
  return typeof raw === 'string' ? parseFloat(raw) : raw;
}

export function toSearchTokens(
  nameEn: string,
  nameKo: string | null,
  formula: string,
  synonyms: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const tokens = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length >= 1) tokens.add(t);
  };

  add(nameEn);
  add(formula.toLowerCase());
  if (nameKo) add(nameKo);
  for (const s of synonyms) add(s);

  return Array.from(tokens);
}

export function normalizeCompound(
  input: NormalizeInput,
): Omit<Compound, 'defaultMolecule' | 'coordinateSource'> {
  const {
    props,
    synonyms,
    nameKo,
    category,
    priority,
    physical,
    canonicalSmiles,
    inchi,
    inchiKey,
  } = input;

  const mw = normalizeMolecularWeight(props.MolecularWeight);

  return {
    cid: props.CID,
    name: { ko: nameKo, en: props.IUPACName ?? props.MolecularFormula },
    molecularFormula: props.MolecularFormula,
    molecularWeight: mw,
    smiles: canonicalSmiles,
    inchi,
    inchiKey,
    iupacName: props.IUPACName ?? null,
    synonyms: normalizeSynonyms(synonyms),
    category,
    priority,
    properties: {
      meltingPointK: physical?.meltingPointK ?? null,
      boilingPointK: physical?.boilingPointK ?? null,
      densityGPerCm3: physical?.densityGPerCm3 ?? null,
      standardState: physical?.standardState ?? 'unknown',
      waterSolubility: physical?.waterSolubility ?? 'unknown',
      logP: props.XLogP ?? null,
    },
  };
}
