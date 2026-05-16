import type { ParsedMol } from '@/engine/rdkit/types';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { Bond } from '@/chemistry/bonds/types';
import type { AtomId, MoleculeId } from '@/chemistry/compounds/ids';
import { createAtomId, createBondId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements';
import { isValidElementNumber } from '@/chemistry/elements';

export function toDomainMolecule(
  parsed: ParsedMol,
  positions: ReadonlyArray<{ x: number; y: number; z: number }>,
  id: MoleculeId,
): Molecule {
  // ParsedMol 원자 인덱스 → 새 안정 AtomId (배열 순서 보존). 무효 elementNumber 는 null.
  const atomIdByIndex: ReadonlyArray<AtomId | null> = parsed.atoms.map((pa) =>
    isValidElementNumber(pa.elementNumber) ? createAtomId() : null,
  );

  const atoms: Atom[] = parsed.atoms
    .map((pa, i): Atom | null => {
      const aid = atomIdByIndex[i];
      if (aid === null || aid === undefined) return null;
      return {
        id: aid,
        elementNumber: pa.elementNumber as ElementNumber,
        position: positions[i] ?? { x: 0, y: 0, z: 0 },
        formalCharge: pa.formalCharge,
        implicitHCount: pa.implicitHCount,
      };
    })
    .filter((a): a is Atom => a !== null);

  // 드롭된 원자를 참조하는 결합은 제외 (양쪽 AtomId 가 유효할 때만).
  const bonds: Bond[] = parsed.bonds
    .map((pb): Bond | null => {
      const a = atomIdByIndex[pb.beginAtomIdx];
      const b = atomIdByIndex[pb.endAtomIdx];
      if (a === null || a === undefined || b === null || b === undefined) return null;
      return { id: createBondId(), aAtomId: a, bAtomId: b, order: pb.order };
    })
    .filter((b): b is Bond => b !== null);

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
