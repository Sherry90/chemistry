import type { ParsedMol } from './types';
import type { Molecule } from '@/chemistry/compounds/types';
import { idToIndex } from '@/chemistry/compounds/ids';

export function toCanonicalSmiles(parsed: ParsedMol): string {
  return parsed.canonicalSmiles;
}

export function toInchi(parsed: ParsedMol): { inchi: string; inchiKey: string } {
  return {
    inchi: parsed.inchi ?? '',
    inchiKey: parsed.inchiKey ?? '',
  };
}

export function toSdfBlock(mol: Molecule): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  Chemistry Platform');
  lines.push('');

  const nAtoms = mol.atoms.length;
  const nBonds = mol.bonds.length;
  lines.push(
    `  ${String(nAtoms).padStart(3)}${String(nBonds).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`,
  );

  for (const atom of mol.atoms) {
    const x = atom.position.x.toFixed(4);
    const y = atom.position.y.toFixed(4);
    const z = atom.position.z.toFixed(4);
    // elementNumber to symbol — import would create circular dep, use placeholder
    lines.push(
      `${x.padStart(10)}${y.padStart(10)}${z.padStart(10)} ${'C'.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`,
    );
  }

  // CD1: SDF 는 직렬화 형태 — 경계에서 AtomId → 0-based 인덱스로 환산 후 1-based 방출.
  const { atomIndexOf } = idToIndex(mol);
  for (const bond of mol.bonds) {
    const order = bond.order === 'aromatic' ? 4 : bond.order;
    const a = atomIndexOf.get(bond.aAtomId);
    const b = atomIndexOf.get(bond.bAtomId);
    if (a === undefined || b === undefined) continue; // 무결성 위반 결합은 스킵
    lines.push(
      `${String(a + 1).padStart(3)}${String(b + 1).padStart(3)}${String(order).padStart(3)}  0`,
    );
  }

  lines.push('M  END');
  lines.push('$$$$');
  return lines.join('\n');
}
