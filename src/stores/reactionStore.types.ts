// Phase 07 §4.3 — reactionStore 상태 타입.
import type { Condition, ReactionResult } from '@/chemistry/reactions/types';
import type { ReactionEngineError } from '@/engine/reaction';
import type { AsyncState, MoleculeId } from './_shared/types';

export type { Condition, ReactionResult };

export interface ReactionStoreState {
  /**
   * 반응물 ID 집합. ReadonlySet 은 immer-비친화 → Record + ids 배열 패턴 (P3).
   */
  readonly reactantSelected: Readonly<Record<MoleculeId, true>>;
  readonly reactantIds: ReadonlyArray<MoleculeId>;

  readonly condition: Condition;

  readonly run: AsyncState<ReactionResult, ReactionEngineError>;

  /** 마지막 성공 결과 — run 이 idle 로 돌아가도 유지하는 정책. */
  readonly lastResult: ReactionResult | null;
  readonly lastAppliedRuleId: string | null;
}

export const DEFAULT_CONDITION: Condition = {
  temperatureK: 298.15, // 25 °C
  pressureAtm: 1.0,
  pH: 7.0,
};

export function makeInitialReactionState(): ReactionStoreState {
  return {
    reactantSelected: {},
    reactantIds: [],
    condition: { ...DEFAULT_CONDITION },
    run: { kind: 'idle' },
    lastResult: null,
    lastAppliedRuleId: null,
  };
}
