import type { Molecule } from '@/chemistry/compounds/types';

export interface Condition {
  readonly temperatureK: number;
  readonly pressureAtm: number;
  readonly pH: number | null;
}

export type ThermoFlag = 'exothermic' | 'endothermic' | 'unknown';

export interface ReactionRule {
  readonly id: string;
  readonly smarts: string;
  readonly conditionRange: Partial<{
    readonly temperatureK: readonly [number, number];
    readonly pressureAtm: readonly [number, number];
    readonly pH: readonly [number, number];
  }>;
  readonly thermo: ThermoFlag;
  readonly source: string;
  // TODO: Phase 06 — 신뢰도/우선순위
}

export type ReactionPredictionKind = 'rule-based' | 'heuristic-experimental';

export interface ReactionResult {
  readonly products: ReadonlyArray<Molecule>;
  readonly kind: ReactionPredictionKind;
  readonly appliedRuleId: string | null;
  readonly thermo: ThermoFlag;
  readonly notes: string | null;
}
