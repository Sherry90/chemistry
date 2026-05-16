import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type { ValidationIssue } from './errors';

export function validateMolecule(mol: Molecule): Result<Molecule, ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check for disconnected fragments (multiple components via simple connectivity check)
  if (mol.atoms.length > 0) {
    const adjacency = new Map<AtomId, AtomId[]>();
    for (const a of mol.atoms) adjacency.set(a.id, []);
    for (const bond of mol.bonds) {
      adjacency.get(bond.aAtomId)?.push(bond.bAtomId);
      adjacency.get(bond.bAtomId)?.push(bond.aAtomId);
    }

    const visited = new Set<AtomId>();
    const queue: AtomId[] = [mol.atoms[0]!.id];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const nb of adjacency.get(curr) ?? []) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }

    if (visited.size < mol.atoms.length) {
      issues.push({
        kind: 'DisconnectedFragments',
        message: 'Molecule has disconnected fragments',
        severity: 'warn',
      });
    }
  }

  // Check formal charges sum
  const chargeSum = mol.atoms.reduce((s, a) => s + a.formalCharge, 0);
  if (chargeSum !== mol.totalCharge) {
    issues.push({
      kind: 'ChargeMismatch',
      message: `Atom formal charges sum (${chargeSum}) differs from molecule totalCharge (${mol.totalCharge})`,
      severity: 'error',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    return err(issues);
  }

  return ok(mol);
}
