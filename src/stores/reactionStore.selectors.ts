// Phase 07 §5.2 — reactionStore selectors + ReactionEngineError → i18n 키 매핑.
import type { Condition, ReactionResult } from '@/chemistry/reactions/types';
import type { ThermoFlag } from '@/chemistry/reactions/types';
import type { ReactionEngineError } from '@/engine/reaction';
import { assertNever, type AsyncState, type MoleculeId } from './_shared/types';
import type { ReactionStoreState } from './reactionStore.types';

export const selectReactantIds = (s: ReactionStoreState): ReadonlyArray<MoleculeId> =>
  s.reactantIds;
export const selectCondition = (s: ReactionStoreState): Condition => s.condition;
export const selectRunState = (
  s: ReactionStoreState,
): AsyncState<ReactionResult, ReactionEngineError> => s.run;
export const selectIsRunning = (s: ReactionStoreState): boolean => s.run.kind === 'loading';
export const selectIsExperimental = (s: ReactionStoreState): boolean =>
  s.run.kind === 'success' && s.run.value.kind === 'heuristic-experimental';
export const selectThermoFlag = (s: ReactionStoreState): ThermoFlag =>
  s.lastResult?.thermo ?? 'unknown';
export const selectAppliedRuleId = (s: ReactionStoreState): string | null => s.lastAppliedRuleId;
export const selectLastResult = (s: ReactionStoreState): ReactionResult | null => s.lastResult;

/**
 * ReactionEngineError → common.json i18n 키 (Phase 07 §5.2 표).
 * 실제 엔진 유니온(9 kinds) 망라 — 'HeuristicAbstained' 는 엔진이 'NoMatchingRule'
 * 로 변환하므로 존재하지 않음 (engine/reaction/types.ts 주석).
 */
export function mapReactionErrorToKey(e: ReactionEngineError): string {
  switch (e.kind) {
    case 'RdkitNotReady':
      return 'reaction.error.rdkitNotReady';
    case 'RdkitInitFailed':
      return 'reaction.error.rdkitInitFailed';
    case 'NoMatchingRule':
      return 'reaction.error.noMatchingRule';
    case 'ConditionOutOfRange':
      return 'reaction.error.conditionOutOfRange';
    case 'InvalidReactant':
      return 'reaction.error.invalidReactant';
    case 'RunReactantsFailed':
      return 'reaction.error.runReactantsFailed';
    case 'EmbedFailed':
      return 'reaction.error.embedFailed';
    case 'Aborted':
      return 'reaction.error.aborted';
    case 'Internal':
      return 'reaction.error.internal';
    default:
      return assertNever(e);
  }
}
