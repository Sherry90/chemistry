import type { RDKitModule } from '@rdkit/rdkit';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type { Molecule } from '@/chemistry/compounds/types';
import type { EmbedError } from '@/engine/geometry/types';
import type { ParsedMol, ParsedAtom, ParsedBond } from '@/engine/rdkit/types';
import { ensureRdkit, getRdkitInstance } from '@/engine/rdkit/service';
import { toDomainMolecule } from '@/engine/parser/toDomain';
import { createMoleculeId } from '@/chemistry/compounds/ids';
import { elementSymbolOf } from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements/types';
import { EMPTY_STEREO } from '@/types/stereo';

// Phase 06 — 휴리스틱 product graph → 3D Molecule.
//
// 근거: `RdkitBackend.embed` 는 `parsed.canonicalSmiles` 를 재파싱하므로 휴리스틱이
// 변형한 atom/bond 그래프를 임베드할 수 없다. 따라서 그래프를 V2000 molblock 으로
// 직렬화 → `rdkit.get_mol(molblock)` → 2D 좌표 생성 경로를 별도로 둔다 (P1 재임베드).

export interface ProductAtom {
  readonly elementNumber: number;
  readonly formalCharge: number;
  readonly implicitHCount: number;
}

export interface ProductBond {
  readonly beginAtomIdx: number;
  readonly endAtomIdx: number;
  readonly order: number; // 1|2|3 = single/double/triple, 4 = aromatic (V2000 bond type)
}

function toMolblock(atoms: ReadonlyArray<ProductAtom>, bonds: ReadonlyArray<ProductBond>): string {
  const lines: string[] = ['', '  ChemPlatform-Heuristic', ''];
  lines.push(
    `${String(atoms.length).padStart(3)}${String(bonds.length).padStart(3)}` +
      `  0  0  0  0  0  0  0  0999 V2000`,
  );
  for (const a of atoms) {
    const sym = elementSymbolOf(a.elementNumber as ElementNumber);
    lines.push(
      `    0.0000    0.0000    0.0000 ${sym.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`,
    );
  }
  for (const b of bonds) {
    lines.push(
      `${String(b.beginAtomIdx + 1).padStart(3)}${String(b.endAtomIdx + 1).padStart(3)}` +
        `${String(b.order).padStart(3)}  0`,
    );
  }
  lines.push('M  END');
  return lines.join('\n');
}

function parseCoords(
  molblock: string,
  expected: number,
): Array<{ x: number; y: number; z: number }> {
  const lines = molblock.split('\n');
  const coords: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 4; i < lines.length && coords.length < expected; i++) {
    const line = lines[i];
    if (!line || line.trim() === 'M  END') break;
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    if (isNaN(x) || isNaN(y)) break;
    coords.push({ x, y, z: 0 });
  }
  while (coords.length < expected) coords.push({ x: 0, y: 0, z: 0 });
  return coords;
}

export async function embedProductGraph(
  atoms: ReadonlyArray<ProductAtom>,
  bonds: ReadonlyArray<ProductBond>,
): Promise<Result<Molecule, EmbedError>> {
  try {
    await ensureRdkit();
  } catch (e) {
    return err({ code: 'RdkitNotReady', message: String(e) });
  }
  const rdkit = getRdkitInstance() as RDKitModule | null;
  if (!rdkit) return err({ code: 'RdkitNotReady', message: 'RDKit instance unavailable' });

  const molblock = toMolblock(atoms, bonds);
  const mol = rdkit.get_mol(molblock);
  if (!mol) {
    return err({ code: 'InvalidMolecule', message: 'Product graph could not be parsed by RDKit' });
  }
  try {
    let canonicalSmiles = '';
    try {
      canonicalSmiles = mol.get_smiles();
    } catch {
      canonicalSmiles = '';
    }
    mol.set_new_coords();
    const coords = parseCoords(mol.get_new_coords(), atoms.length);

    const parsedAtoms: ParsedAtom[] = atoms.map((a, i) => ({
      index: i,
      elementNumber: a.elementNumber,
      formalCharge: a.formalCharge,
      isotope: null,
      implicitHCount: a.implicitHCount,
      aromaticFlag: false,
    }));
    const parsedBonds: ParsedBond[] = bonds.map((b) => ({
      beginAtomIdx: b.beginAtomIdx,
      endAtomIdx: b.endAtomIdx,
      order: b.order === 4 ? ('aromatic' as const) : (b.order as 1 | 2 | 3),
      stereoTag: 'none',
    }));
    const totalCharge = atoms.reduce((s, a) => s + a.formalCharge, 0);

    const parsed: ParsedMol = {
      source: { kind: 'smiles', raw: canonicalSmiles, normalized: canonicalSmiles },
      canonicalSmiles,
      formula: '',
      molecularWeight: 0,
      totalCharge,
      radicalElectrons: 0,
      atoms: parsedAtoms,
      bonds: parsedBonds,
      stereo: EMPTY_STEREO,
      inchi: null,
      inchiKey: null,
    };
    return ok(toDomainMolecule(parsed, coords, createMoleculeId()));
  } catch (e) {
    return err({ code: 'InternalError', message: String(e) });
  } finally {
    mol.delete();
  }
}
