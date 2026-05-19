// Phase 11 — Molecule → Hill 분자식 + 분자량 (implicitH 포함). 순수 derive
// (@/chemistry/elements 정적 데이터, P1 예외). MoleculeCard + MoleculeInfo 공용.
import type { Molecule } from '@/chemistry/compounds/types';
import type { ElementNumber } from '@/chemistry/elements/types';
import { getElement } from '@/chemistry/elements';

export function deriveFormulaWeight(m: Molecule): {
  readonly formula: string;
  readonly weight: number;
} {
  const counts = new Map<string, number>();
  let weight = 0;
  let hImplicit = 0;
  for (const a of m.atoms) {
    const el = getElement(a.elementNumber);
    if (!el) continue;
    counts.set(el.symbol, (counts.get(el.symbol) ?? 0) + 1);
    weight += el.atomicMass;
    hImplicit += a.implicitHCount;
  }
  if (hImplicit > 0) {
    counts.set('H', (counts.get('H') ?? 0) + hImplicit);
    const h = getElement(1 as ElementNumber);
    if (h) weight += h.atomicMass * hImplicit;
  }
  const part = (sym: string): string => {
    const n = counts.get(sym) ?? 0;
    return n === 0 ? '' : n === 1 ? sym : `${sym}${n}`;
  };
  const rest = [...counts.keys()]
    .filter((s) => s !== 'C' && s !== 'H')
    .sort()
    .map(part)
    .join('');
  const formula = `${part('C')}${part('H')}${rest}` || '—';
  return { formula, weight };
}
