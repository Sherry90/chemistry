import type { ParsedMol } from '@/engine/rdkit/types';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { ElementNumber } from '@/chemistry/elements';
import { isValidElementNumber } from '@/chemistry/elements';

export function toDomainMolecule(
  parsed: ParsedMol,
  positions: ReadonlyArray<{ x: number; y: number; z: number }>,
  id: string,
): Molecule {
  const atoms: Atom[] = parsed.atoms
    .map((pa, i): Atom | null => {
      if (!isValidElementNumber(pa.elementNumber)) return null;
      return {
        elementNumber: pa.elementNumber as ElementNumber,
        position: positions[i] ?? { x: 0, y: 0, z: 0 },
        formalCharge: pa.formalCharge,
        implicitHCount: pa.implicitHCount,
      };
    })
    .filter((a): a is Atom => a !== null);

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
