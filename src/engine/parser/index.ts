import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type { Molecule } from '@/chemistry/compounds/types';
import type { ParsedMol } from '@/engine/rdkit/types';
import type { ParseError } from './errors';
import type { EmbedOptions, EmbedError } from '@/engine/geometry/types';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import { normalizeSmiles, normalizeInchi, normalizeFormula } from './normalize';
import { formulaToHillKey } from './formula';
import type { FormulaComposition } from './formula';
import { FORMULA_TO_SMILES } from './formula-map';
import { FORMULA_MAP_GENERATED } from './formula-map.generated';
import { getParsedMol, setParsedMol } from '@/engine/rdkit/cache';
import { embed3D } from '@/engine/geometry/embed';

export type { ParseError } from './errors';
export type { FormulaComposition, FormulaEntry } from './formula';
export { parseFormula } from './formula';
export { validateMolecule } from './validate';

let _backend: RdkitBackend | null = null;

export function setRdkitBackend(backend: RdkitBackend): void {
  _backend = backend;
}

function getBackend(): RdkitBackend {
  if (!_backend) throw new Error('RdkitBackend not set — call setRdkitBackend() first');
  return _backend;
}

export async function parseSmiles(input: string): Promise<Result<ParsedMol, ParseError>> {
  const normalized = normalizeSmiles(input);
  if (!normalized.ok) return normalized;

  const cached = getParsedMol('smiles', normalized.value);
  if (cached) return ok(cached);

  const result = await getBackend().parseSmiles(normalized.value);
  if (result.ok) setParsedMol('smiles', normalized.value, result.value);
  return result;
}

export async function parseInchi(input: string): Promise<Result<ParsedMol, ParseError>> {
  const normalized = normalizeInchi(input);
  if (!normalized.ok) return normalized;

  const cached = getParsedMol('inchi', normalized.value);
  if (cached) return ok(cached);

  const result = await getBackend().parseInchi(normalized.value);
  if (result.ok) setParsedMol('inchi', normalized.value, result.value);
  return result;
}

export { parseFormula as parseFormulaComposition } from './formula';

export async function formulaToParsedMol(
  comp: FormulaComposition,
): Promise<Result<ParsedMol, ParseError>> {
  const hillKey = formulaToHillKey(comp);
  // Manual map takes priority over generated map (§6.8)
  const smiles = FORMULA_TO_SMILES[hillKey] ?? FORMULA_MAP_GENERATED.get(hillKey)?.smiles;
  if (!smiles) {
    return err({
      code: 'FormulaUnsupported',
      message: `No SMILES mapping for formula: ${hillKey}`,
    });
  }
  return parseSmiles(smiles);
}

export async function toMoleculeWith3D(
  parsed: ParsedMol,
  opts: Partial<EmbedOptions> = {},
): Promise<Result<Molecule, EmbedError>> {
  return embed3D(parsed, getBackend(), opts);
}

export async function smilesTo3DMolecule(
  input: string,
  opts: Partial<EmbedOptions> = {},
): Promise<Result<Molecule, ParseError | EmbedError>> {
  const normalized = normalizeSmiles(input);
  if (!normalized.ok) return normalized;

  const parsed = await parseSmiles(normalized.value);
  if (!parsed.ok) return parsed;

  return toMoleculeWith3D(parsed.value, opts);
}

export async function inchiTo3DMolecule(
  input: string,
  opts: Partial<EmbedOptions> = {},
): Promise<Result<Molecule, ParseError | EmbedError>> {
  const normalized = normalizeInchi(input);
  if (!normalized.ok) return normalized;

  const parsed = await parseInchi(normalized.value);
  if (!parsed.ok) return parsed;

  return toMoleculeWith3D(parsed.value, opts);
}

export { normalizeSmiles, normalizeInchi, normalizeFormula };
