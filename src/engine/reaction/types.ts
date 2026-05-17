import type { Molecule } from '@/chemistry/compounds/types';
import type { Condition, ReactionResult } from '@/chemistry/reactions/types';
import type { Result } from '@/types/result';
import type { RdkitInitError } from '@/engine/rdkit/types';
import type { EmbedError } from '@/engine/geometry/types';

export interface PredictInput {
  readonly reactants: ReadonlyArray<Molecule>;
  readonly condition: Condition;
}

export interface PredictOptions {
  readonly signal?: AbortSignal; // P5: 규칙 시도 사이에서만 honored
  readonly force?: boolean; // 캐시 무시
}

export type PredictOutput = Result<ReactionResult, ReactionEngineError>;

export type HeuristicAbstainReason =
  | 'no-candidate-pair'
  | 'too-many-bond-changes'
  | 'embed-failed'
  | 'electronegativity-data-missing';

// Phase 06 §4.7 — phase-05 §4.3 shape 차용 ({ kind, ..., retryable }).
// ※ 'HeuristicAbstained' 는 의도적으로 없음 — predict 가 abstain 을 'NoMatchingRule' 로 변환
//   (§6.1 ⑥). abstain 사유는 HeuristicError + logger.warn 에만 남는다.
export type ReactionEngineError =
  | { readonly kind: 'RdkitNotReady'; readonly retryable: true }
  | { readonly kind: 'RdkitInitFailed'; readonly cause: RdkitInitError; readonly retryable: false }
  | {
      readonly kind: 'NoMatchingRule';
      readonly triedRuleIds: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'ConditionOutOfRange';
      readonly nearestRuleIds: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'InvalidReactant';
      readonly issues: ReadonlyArray<string>;
      readonly retryable: false;
    }
  | {
      readonly kind: 'RunReactantsFailed';
      readonly ruleId: string;
      readonly rdkitMessage: string;
      readonly retryable: false;
    }
  | {
      readonly kind: 'EmbedFailed';
      readonly ruleId: string | null;
      readonly cause: EmbedError;
      readonly retryable: true;
    }
  | { readonly kind: 'Aborted'; readonly retryable: false }
  | { readonly kind: 'Internal'; readonly detail: string; readonly retryable: false };

export type HeuristicError =
  | { readonly kind: 'HeuristicAbstained'; readonly reason: HeuristicAbstainReason }
  | { readonly kind: 'EmbedFailed'; readonly cause: EmbedError }
  | { readonly kind: 'Internal'; readonly detail: string };
