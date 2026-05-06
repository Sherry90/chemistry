import type { ParsedMol } from './types';
import type { Molecule } from '@/chemistry/compounds/types';

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

  for (const bond of mol.bonds) {
    const order = bond.order === 'aromatic' ? 4 : bond.order;
    lines.push(
      `${String(bond.aAtomId + 1).padStart(3)}${String(bond.bAtomId + 1).padStart(3)}${String(order).padStart(3)}  0`,
    );
  }

  lines.push('M  END');
  lines.push('$$$$');
  return lines.join('\n');
}
