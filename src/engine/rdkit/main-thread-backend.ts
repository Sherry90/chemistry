import type { RDKitModule, JSMol } from '@rdkit/rdkit';
import type { RdkitBackend } from './backend';
import type { ParsedMol, ParsedAtom, ParsedBond, InputSource, StereoAnnotations } from './types';
import type { ParseError } from '@/engine/parser/errors';
import type { EmbedOptions, EmbedError } from '@/engine/geometry/types';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import { ensureRdkit, getRdkitInstance } from './service';
import { EMPTY_STEREO } from '@/types/stereo';
import { isValidElementNumber } from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements';

function extractParsedMol(mol: JSMol, source: InputSource): ParsedMol {
  const canonicalSmiles = mol.get_smiles();
  const descJson = mol.get_descriptors();
  let molecularWeight = 0;
  let formula = '';
  try {
    const desc = JSON.parse(descJson) as Record<string, unknown>;
    molecularWeight = (desc['MolWt'] as number | undefined) ?? 0;
    formula = (desc['MolecularFormula'] as string | undefined) ?? '';
  } catch {
    // ignore parse failure
  }

  const inchi = mol.get_inchi();
  const inchiKey = inchi
    ? (() => {
        const rdkit = getRdkitInstance() as RDKitModule | null;
        return rdkit?.get_inchikey_for_inchi(inchi) ?? null;
      })()
    : null;

  // Parse atom/bond info from JSON
  let totalCharge = 0;
  let atoms: ParsedAtom[] = [];
  let bonds: ParsedBond[] = [];

  try {
    const molJson = JSON.parse(mol.get_json()) as {
      molecules?: Array<{
        atoms?: Array<{ z?: number; chg?: number; elem?: string; impHs?: number; nRad?: number }>;
        bonds?: Array<{ atoms: [number, number]; order: number }>;
      }>;
    };
    const firstMol = molJson.molecules?.[0];
    if (firstMol) {
      atoms = (firstMol.atoms ?? []).map((a, i): ParsedAtom => {
        const sym = a.elem ?? 'C';
        // Resolve element number from symbol via import
        const elemNum = resolveElementNumber(sym);
        const fc = a.chg ?? 0;
        totalCharge += fc;
        return {
          index: i,
          elementNumber: elemNum,
          formalCharge: fc,
          isotope: null,
          implicitHCount: a.impHs ?? 0,
          aromaticFlag: false,
        };
      });

      bonds = (firstMol.bonds ?? []).map((b): ParsedBond => {
        const order = b.order === 1.5 ? 'aromatic' : (b.order as 1 | 2 | 3);
        return {
          beginAtomIdx: b.atoms[0],
          endAtomIdx: b.atoms[1],
          order,
          stereoTag: 'none',
        };
      });
    }
  } catch {
    // fallback: no atoms/bonds
  }

  const stereo: StereoAnnotations = EMPTY_STEREO;

  return {
    source,
    canonicalSmiles,
    formula,
    molecularWeight,
    totalCharge,
    radicalElectrons: 0,
    atoms,
    bonds,
    stereo,
    inchi: inchi || null,
    inchiKey,
  };
}

function resolveElementNumber(symbol: string): number {
  // Static lookup for common elements used in parsing
  const SYMBOL_TO_NUM: Record<string, number> = {
    H: 1,
    He: 2,
    Li: 3,
    Be: 4,
    B: 5,
    C: 6,
    N: 7,
    O: 8,
    F: 9,
    Ne: 10,
    Na: 11,
    Mg: 12,
    Al: 13,
    Si: 14,
    P: 15,
    S: 16,
    Cl: 17,
    Ar: 18,
    K: 19,
    Ca: 20,
    Fe: 26,
    Cu: 29,
    Zn: 30,
    Br: 35,
    Ag: 47,
    I: 53,
    Au: 79,
  };
  return SYMBOL_TO_NUM[symbol] ?? 6;
}

function parsedMolToMolecule(
  parsed: ParsedMol,
  id: string,
  coords: Array<{ x: number; y: number; z: number }>,
): Molecule {
  const atoms: Atom[] = parsed.atoms
    .filter((pa) => isValidElementNumber(pa.elementNumber))
    .map(
      (pa, i): Atom => ({
        elementNumber: pa.elementNumber as ElementNumber,
        position: coords[i] ?? { x: 0, y: 0, z: 0 },
        formalCharge: pa.formalCharge,
        implicitHCount: pa.implicitHCount,
      }),
    );

  const bonds: Bond[] = parsed.bonds.map((pb) => ({
    aAtomId: pb.beginAtomIdx,
    bAtomId: pb.endAtomIdx,
    order: pb.order,
  }));

  return {
    id,
    atoms,
    bonds,
    totalCharge: parsed.totalCharge,
    canonicalSmiles: parsed.canonicalSmiles,
    inchi: parsed.inchi,
    inchiKey: parsed.inchiKey,
    stereo: parsed.stereo,
    spinMultiplicity: parsed.radicalElectrons + 1,
  };
}

export function createMainThreadRdkitBackend(): RdkitBackend {
  async function ensureAndGet(): Promise<RDKitModule> {
    await ensureRdkit();
    const rdkit = getRdkitInstance() as RDKitModule | null;
    if (!rdkit) throw new Error('RDKit not initialized');
    return rdkit;
  }

  function tryParseMol(
    rdkit: RDKitModule,
    input: string,
    source: InputSource,
  ): Result<ParsedMol, ParseError> {
    const mol = rdkit.get_mol(input);
    if (!mol) {
      return err({ code: 'SmilesSyntax', message: 'Invalid input: null molecule returned' });
    }
    try {
      return ok(extractParsedMol(mol, source));
    } finally {
      mol.delete();
    }
  }

  return {
    async parseSmiles(input: string) {
      try {
        const rdkit = await ensureAndGet();
        const source: InputSource = { kind: 'smiles', raw: input, normalized: input.trim() };
        return tryParseMol(rdkit, input.trim(), source);
      } catch (e) {
        return err({ code: 'RdkitNotReady', message: String(e) });
      }
    },

    async parseInchi(input: string) {
      try {
        const rdkit = await ensureAndGet();
        const source: InputSource = { kind: 'inchi', raw: input, normalized: input.trim() };
        // RDKit minimal doesn't have a direct InChI parser; get_mol accepts molfile/SMILES/JSON
        // Try parsing as generic input (may work for some InChI via internal RDKit routing)
        return tryParseMol(rdkit, input.trim(), source);
      } catch (e) {
        return err({ code: 'RdkitNotReady', message: String(e) });
      }
    },

    async parseSdfBlock(sdf: string) {
      try {
        const rdkit = await ensureAndGet();
        const source: InputSource = { kind: 'smiles', raw: sdf, normalized: sdf.trim() };
        // get_mol accepts MolFile format
        return tryParseMol(rdkit, sdf.trim(), source);
      } catch (e) {
        return err({ code: 'RdkitNotReady', message: String(e) });
      }
    },

    async embed(parsed: ParsedMol, _opts: EmbedOptions): Promise<Result<Molecule, EmbedError>> {
      try {
        const rdkit = await ensureAndGet();
        const mol = rdkit.get_mol(parsed.canonicalSmiles);
        if (!mol) {
          return err({ code: 'InvalidMolecule', message: 'Could not recreate molecule for embed' });
        }

        try {
          // RDKit minimal provides 2D coord generation; use as placeholder with z=0
          mol.set_new_coords();
          const molblock = mol.get_new_coords();
          const coords = parseMolblockCoords(molblock, parsed.atoms.length);

          return ok(parsedMolToMolecule(parsed, crypto.randomUUID(), coords));
        } finally {
          mol.delete();
        }
      } catch (e) {
        return err({ code: 'InternalError', message: String(e) });
      }
    },

    async toCanonical(parsed: ParsedMol) {
      return {
        smiles: parsed.canonicalSmiles,
        inchi: parsed.inchi ?? '',
        inchiKey: parsed.inchiKey ?? '',
      };
    },
  };
}

function parseMolblockCoords(
  molblock: string,
  expectedAtoms: number,
): Array<{ x: number; y: number; z: number }> {
  const lines = molblock.split('\n');
  const coords: Array<{ x: number; y: number; z: number }> = [];

  // V2000 Molfile: line 4 (index 3) is counts line, atom block starts at line 4 (index 4)
  if (lines.length < 4) return Array.from({ length: expectedAtoms }, () => ({ x: 0, y: 0, z: 0 }));

  for (let i = 4; i < lines.length && coords.length < expectedAtoms; i++) {
    const line = lines[i];
    if (!line || line.trim() === 'M  END') break;
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    if (isNaN(x) || isNaN(y)) break;
    coords.push({ x, y, z: 0 });
  }

  while (coords.length < expectedAtoms) coords.push({ x: 0, y: 0, z: 0 });
  return coords;
}
