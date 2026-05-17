import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type { ReactionResult, ThermoFlag } from '@/chemistry/reactions/types';
import { getElementUnsafe } from '@/chemistry/elements';
import type { PredictInput } from './types';
import type { HeuristicError } from './types';
import { HEURISTIC_CONFIDENCE } from './confidence';
import { targetValenceOf } from './oxidation-states';
import { embedProductGraph } from './product-embed';
import type { ProductAtom, ProductBond } from './product-embed';

// Phase 06 §6.7 — U4 휴리스틱 본 구현.
// 원자가 미충족 + 전기음성도 차 기반 결합 형성 추정. 결과는 항상 experimental.

const CHI_H = getElementUnsafe(1)?.electronegativity ?? 2.2;
const MIN_DELTA_CHI = 0.5;
const EXO_FORMED_DELTA_CHI = 1.0;
const ENDO_BROKEN_DELTA_CHI = 0.5;

interface GAtom {
  elementNumber: number;
  formalCharge: number;
  implicitHCount: number;
  chi: number;
  reactantIdx: number;
}

function bondOrderNum(o: 1 | 2 | 3 | 'aromatic'): number {
  return o === 'aromatic' ? 1.5 : o;
}

export async function tryHeuristic(
  input: PredictInput,
): Promise<Result<ReactionResult, HeuristicError>> {
  // 1. 전 reactant atom 평탄화 + 전기음성도/원자가.
  const gAtoms: GAtom[] = [];
  const gBonds: ProductBond[] = [];
  const idxOf = new Map<string, number>(); // `${reactantIdx}:${atomId}` → global idx

  for (let r = 0; r < input.reactants.length; r++) {
    const mol = input.reactants[r]!;
    for (const a of mol.atoms) {
      const el = getElementUnsafe(a.elementNumber);
      const chi = el?.electronegativity ?? null;
      const target = targetValenceOf(a.elementNumber);
      if (chi === null || target === null) {
        return err({ kind: 'HeuristicAbstained', reason: 'electronegativity-data-missing' });
      }
      idxOf.set(`${r}:${a.id}`, gAtoms.length);
      gAtoms.push({
        elementNumber: a.elementNumber,
        formalCharge: a.formalCharge,
        implicitHCount: a.implicitHCount,
        chi,
        reactantIdx: r,
      });
    }
    for (const b of mol.bonds) {
      const bi = idxOf.get(`${r}:${b.aAtomId}`);
      const ei = idxOf.get(`${r}:${b.bAtomId}`);
      if (bi === undefined || ei === undefined) continue;
      gBonds.push({
        beginAtomIdx: bi,
        endAtomIdx: ei,
        order: b.order === 'aromatic' ? 4 : b.order,
      });
    }
  }

  if (gAtoms.length === 0) {
    return err({ kind: 'HeuristicAbstained', reason: 'no-candidate-pair' });
  }

  // 2. 충족 원자가 / 불포화 판정.
  const filled = (gi: number): number => {
    const a = gAtoms[gi]!;
    let sum = a.implicitHCount + Math.abs(a.formalCharge);
    for (const bd of gBonds) {
      if (bd.beginAtomIdx === gi || bd.endAtomIdx === gi) {
        sum += bondOrderNum(bd.order === 4 ? 'aromatic' : (bd.order as 1 | 2 | 3));
      }
    }
    return sum;
  };
  const isUnsaturated = (gi: number): boolean => {
    const t = targetValenceOf(gAtoms[gi]!.elementNumber);
    return t !== null && filled(gi) < t;
  };

  // 3. 후보 쌍 (다른 reactant 사이, Δχ ≥ 0.5), Δχ 내림차순.
  const pairs: Array<{ a: number; b: number; dchi: number }> = [];
  for (let i = 0; i < gAtoms.length; i++) {
    if (!isUnsaturated(i)) continue;
    for (let j = i + 1; j < gAtoms.length; j++) {
      if (gAtoms[i]!.reactantIdx === gAtoms[j]!.reactantIdx) continue;
      if (!isUnsaturated(j)) continue;
      const dchi = Math.abs(gAtoms[i]!.chi - gAtoms[j]!.chi);
      if (dchi >= MIN_DELTA_CHI) pairs.push({ a: i, b: j, dchi });
    }
  }
  pairs.sort((x, y) => y.dchi - x.dchi);

  // 4.
  if (pairs.length === 0) {
    return err({ kind: 'HeuristicAbstained', reason: 'no-candidate-pair' });
  }
  // 5. 후보 초과 시 abstain (무음 절단 금지 — §6.7 step5 정정).
  if (pairs.length > 2) {
    return err({ kind: 'HeuristicAbstained', reason: 'too-many-bond-changes' });
  }
  const selected = pairs;

  // 6. product graph 구성 — 선택 쌍에 결합 추가/증가 + H 이동.
  for (const sel of selected) {
    const existing = gBonds.find(
      (bd) =>
        (bd.beginAtomIdx === sel.a && bd.endAtomIdx === sel.b) ||
        (bd.beginAtomIdx === sel.b && bd.endAtomIdx === sel.a),
    );
    if (!existing) {
      gBonds.push({ beginAtomIdx: sel.a, endAtomIdx: sel.b, order: 1 });
    } else if (existing.order === 1 || existing.order === 2) {
      const idx = gBonds.indexOf(existing);
      gBonds[idx] = { ...existing, order: existing.order + 1 };
    } else {
      // 삼중 이상 (또는 aromatic=4) → 의미 없는 변환 회피.
      return err({ kind: 'HeuristicAbstained', reason: 'too-many-bond-changes' });
    }
    // H 이동 가정 — 양 원자 implicitH -1 (음수 클램프).
    gAtoms[sel.a] = {
      ...gAtoms[sel.a]!,
      implicitHCount: Math.max(0, gAtoms[sel.a]!.implicitHCount - 1),
    };
    gAtoms[sel.b] = {
      ...gAtoms[sel.b]!,
      implicitHCount: Math.max(0, gAtoms[sel.b]!.implicitHCount - 1),
    };
  }

  // 7. embed.
  const productAtoms: ProductAtom[] = gAtoms.map((a) => ({
    elementNumber: a.elementNumber,
    formalCharge: a.formalCharge,
    implicitHCount: a.implicitHCount,
  }));
  const embedded = await embedProductGraph(productAtoms, gBonds);
  if (!embedded.ok) {
    return err({ kind: 'EmbedFailed', cause: embedded.error });
  }

  // 8. thermo 결정 (§6.6 정량 기준).
  const avgFormed = selected.reduce((s, p) => s + p.dchi, 0) / Math.max(1, selected.length);
  // 깨진 X-H 결합 Δχ 평균 (각 selected 쌍의 두 원자가 H 를 잃음).
  const brokenDeltas: number[] = [];
  for (const sel of selected) {
    brokenDeltas.push(Math.abs(gAtoms[sel.a]!.chi - CHI_H));
    brokenDeltas.push(Math.abs(gAtoms[sel.b]!.chi - CHI_H));
  }
  const avgBroken =
    brokenDeltas.length > 0
      ? brokenDeltas.reduce((s, d) => s + d, 0) / brokenDeltas.length
      : Number.NaN;

  let thermo: ThermoFlag;
  if (avgFormed >= EXO_FORMED_DELTA_CHI) thermo = 'exothermic';
  else if (avgBroken < ENDO_BROKEN_DELTA_CHI) thermo = 'endothermic';
  else thermo = 'unknown';

  // 9.
  return ok({
    products: [embedded.value],
    kind: 'heuristic-experimental',
    appliedRuleId: null,
    thermo,
    confidence: HEURISTIC_CONFIDENCE,
    notes: 'reaction.experimentalDisclaimer',
  });
}
