// Phase 07 §5.1 — moleculeStore selector helpers.
import type { Molecule } from '@/chemistry/compounds/types';
import type { BondOrder } from '@/chemistry/bonds/types';
import { getElement } from '@/chemistry/elements';
import type { AsyncState, IngestError, MoleculeId } from './_shared/types';
import type { MoleculeStoreState } from './moleculeStore.types';

export const selectActiveMolecule = (s: MoleculeStoreState): Molecule | null =>
  s.activeId ? (s.molecules[s.activeId] ?? null) : null;

export const selectMoleculeById =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): Molecule | null =>
    s.molecules[id] ?? null;

export const selectMoleculeIds = (s: MoleculeStoreState): ReadonlyArray<MoleculeId> => s.ids;

export const selectIngestState = (s: MoleculeStoreState): AsyncState<MoleculeId, IngestError> =>
  s.ingest;

/**
 * Phase 13 export 용 — 직렬화 가능한 dump (Date/Map/Set/함수 미포함).
 * 정확한 필드 동결은 Phase 13 가 export 포맷 결정 시 수행 (본 Phase 는 *형태 보장*만).
 */
export type MoleculeSnapshot = Molecule;

export const selectMoleculeSnapshot =
  (id: MoleculeId) =>
  (s: MoleculeStoreState): MoleculeSnapshot | null => {
    const m = s.molecules[id];
    return m ? (structuredClone(m) as MoleculeSnapshot) : null;
  };

// ── Phase 11 §4.7 retrofit — selectBondMetrics (standalone 순수 + WeakMap memo) ──

export interface BondMetric {
  readonly bondIndex: number;
  readonly atom1Index: number;
  readonly atom2Index: number;
  readonly atom1Symbol: string;
  readonly atom2Symbol: string;
  readonly order: BondOrder;
  readonly lengthAngstrom: number;
}

export interface BondAngleMetric {
  readonly atom1Index: number;
  readonly atom2Index: number; // vertex
  readonly atom3Index: number;
  readonly angleDegrees: number;
}

export interface BondMetricsResult {
  readonly lengths: ReadonlyArray<BondMetric>;
  readonly angles: ReadonlyArray<BondAngleMetric>;
}

const bondMetricsCache = new WeakMap<Molecule, BondMetricsResult>();

const symbolOf = (n: number): string => getElement(n as never)?.symbol ?? String(n);

/**
 * 활성 분자의 결합 길이/각. Molecule 참조를 키로 WeakMap memoize
 * (immer immutable → 내용 변경 시 새 참조 → miss → 재계산). null → null.
 */
export function selectBondMetrics(m: Molecule | null): BondMetricsResult | null {
  if (!m) return null;
  const cached = bondMetricsCache.get(m);
  if (cached) return cached;

  const idx = new Map(m.atoms.map((a, i) => [a.id, i]));
  const lengths: BondMetric[] = [];
  m.bonds.forEach((b, bondIndex) => {
    const i1 = idx.get(b.aAtomId);
    const i2 = idx.get(b.bAtomId);
    if (i1 == null || i2 == null) return;
    const p1 = m.atoms[i1]!.position;
    const p2 = m.atoms[i2]!.position;
    lengths.push({
      bondIndex,
      atom1Index: i1,
      atom2Index: i2,
      atom1Symbol: symbolOf(m.atoms[i1]!.elementNumber),
      atom2Symbol: symbolOf(m.atoms[i2]!.elementNumber),
      order: b.order,
      lengthAngstrom: Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z),
    });
  });

  // 인접 결합 쌍 → vertex 각. atom 별 이웃 목록 구축.
  const neighbors = new Map<number, number[]>();
  for (const bm of lengths) {
    (neighbors.get(bm.atom1Index) ?? neighbors.set(bm.atom1Index, []).get(bm.atom1Index)!).push(
      bm.atom2Index,
    );
    (neighbors.get(bm.atom2Index) ?? neighbors.set(bm.atom2Index, []).get(bm.atom2Index)!).push(
      bm.atom1Index,
    );
  }
  const angles: BondAngleMetric[] = [];
  for (const [vertex, nb] of neighbors) {
    for (let a = 0; a < nb.length; a++) {
      for (let c = a + 1; c < nb.length; c++) {
        const v = m.atoms[vertex]!.position;
        const p1 = m.atoms[nb[a]!]!.position;
        const p2 = m.atoms[nb[c]!]!.position;
        const v1 = [p1.x - v.x, p1.y - v.y, p1.z - v.z];
        const v2 = [p2.x - v.x, p2.y - v.y, p2.z - v.z];
        const dot = v1[0]! * v2[0]! + v1[1]! * v2[1]! + v1[2]! * v2[2]!;
        const n1 = Math.hypot(v1[0]!, v1[1]!, v1[2]!);
        const n2 = Math.hypot(v2[0]!, v2[1]!, v2[2]!);
        if (n1 === 0 || n2 === 0) continue;
        const cos = Math.max(-1, Math.min(1, dot / (n1 * n2)));
        angles.push({
          atom1Index: nb[a]!,
          atom2Index: vertex,
          atom3Index: nb[c]!,
          angleDegrees: (Math.acos(cos) * 180) / Math.PI,
        });
      }
    }
  }

  const result: BondMetricsResult = { lengths, angles };
  bondMetricsCache.set(m, result);
  return result;
}
