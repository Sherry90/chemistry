import type { Compound, CoordinateSource } from '@/chemistry/compounds/types';
import type { CompoundCategory } from '@/chemistry/compounds/categories';
import type { PhysicalState } from '@/chemistry/compounds/types';
import { asCompoundId, moleculeIdForCid } from '@/chemistry/compounds/ids';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { Result } from '@/types/result';
import { EMBED_SEED_PRIMARY } from '@/engine/geometry/types';

export const NORMALIZE_SCHEMA_VERSION = 2 as const;

// ── Phase 05: PubChem response → Compound (shared build-time + runtime) ──────

export interface PubChemPropertyRow {
  readonly CID: number;
  readonly MolecularFormula: string;
  readonly MolecularWeight: string | number;
  // Phase 15 hotfix — PubChem 2025+ 필드 (SMILES/ConnectivitySMILES) 신규 추가.
  // legacy 필드 (CanonicalSMILES/IsomericSMILES) 는 캐시/fixture 호환용 fallback.
  readonly SMILES?: string;
  readonly ConnectivitySMILES?: string;
  readonly CanonicalSMILES?: string;
  readonly IsomericSMILES?: string;
  readonly InChI?: string;
  readonly InChIKey?: string;
  readonly IUPACName?: string;
  readonly XLogP?: number | string;
  readonly Complexity?: number | string;
}

export type NormalizeError =
  | { readonly kind: 'SmilesParseFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'EmbedFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'SdfParseFailed'; readonly cid: number; readonly detail: string }
  | { readonly kind: 'MissingRequiredField'; readonly cid: number; readonly field: string };

export interface NormalizeOptions {
  readonly rdkit: RdkitBackend;
  readonly fillRuntimeDefaults: boolean;
}

export async function normalizePubChemResponse(
  row: PubChemPropertyRow,
  sdf: string | null,
  opts: NormalizeOptions,
): Promise<Result<Compound, NormalizeError>> {
  const { rdkit, fillRuntimeDefaults } = opts;
  const cid = row.CID;

  if (!row.MolecularFormula) {
    return {
      ok: false,
      error: { kind: 'MissingRequiredField', cid, field: 'MolecularFormula' },
    };
  }

  // Phase 15 hotfix — 신규 SMILES → ConnectivitySMILES → legacy 순.
  // SMILES 가 stereo 포함 (구 IsomericSMILES 등가), ConnectivitySMILES 는 connectivity-only.
  const rawSmiles =
    row.SMILES ?? row.ConnectivitySMILES ?? row.IsomericSMILES ?? row.CanonicalSMILES;
  if (!rawSmiles) {
    return {
      ok: false,
      error: { kind: 'SmilesParseFailed', cid, detail: 'No SMILES available in response' },
    };
  }

  const parsed = await rdkit.parseSmiles(rawSmiles);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { kind: 'SmilesParseFailed', cid, detail: parsed.error.message },
    };
  }

  const canonical = await rdkit.toCanonical(parsed.value);

  let defaultMolecule = null;
  let coordinateSource: CoordinateSource = 'rdkit-etkdg';

  if (sdf) {
    const sdfParsed = await rdkit.parseSdfBlock(sdf);
    if (sdfParsed.ok) {
      const embedded = await rdkit.embed(sdfParsed.value, {
        seed: EMBED_SEED_PRIMARY,
        maxIters: 2000,
        useRandomCoords: false,
        optimize: 'mmff94',
        timeoutMs: 4000,
      });
      if (embedded.ok) {
        defaultMolecule = { ...embedded.value, id: moleculeIdForCid(cid) };
        coordinateSource = 'pubchem-3d';
      }
    }
  }

  if (!defaultMolecule) {
    const embedded = await rdkit.embed(parsed.value, {
      seed: EMBED_SEED_PRIMARY,
      maxIters: 2000,
      useRandomCoords: false,
      optimize: 'mmff94',
      timeoutMs: 4000,
    });
    if (!embedded.ok) {
      return {
        ok: false,
        error: { kind: 'EmbedFailed', cid, detail: embedded.error.code },
      };
    }
    defaultMolecule = { ...embedded.value, id: moleculeIdForCid(cid) };
  }

  const mw = normalizeMolecularWeight(row.MolecularWeight);
  const logP =
    row.XLogP == null
      ? null
      : typeof row.XLogP === 'number'
        ? row.XLogP
        : parseFloat(row.XLogP) || null;

  const compound: Compound = {
    cid: asCompoundId(cid),
    provenance: fillRuntimeDefaults ? 'runtime-fetch' : 'manifest',
    name: { ko: null, en: row.IUPACName ?? row.MolecularFormula },
    molecularFormula: row.MolecularFormula,
    molecularWeight: mw,
    smiles: canonical.smiles,
    inchi: canonical.inchi || row.InChI || null,
    inchiKey: canonical.inchiKey || row.InChIKey || null,
    iupacName: row.IUPACName ?? null,
    synonyms: [],
    category: (fillRuntimeDefaults ? 'inorganic-common' : 'inorganic-common') as CompoundCategory,
    priority: fillRuntimeDefaults ? 9999 : 0,
    properties: {
      meltingPointK: null,
      boilingPointK: null,
      densityGPerCm3: null,
      standardState: 'unknown' as PhysicalState,
      waterSolubility: 'unknown',
      logP,
    },
    coordinateSource,
    defaultMolecule,
  };

  return { ok: true, value: compound };
}

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
    cid: asCompoundId(props.CID),
    provenance: 'manifest',
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
