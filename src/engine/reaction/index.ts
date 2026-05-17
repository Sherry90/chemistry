// Phase 06 §5.1 — 단일 공개 진입점.
// 외부(stores/panels)는 이 파일만 import (§7.2 공개 경계).
export { predict } from './predict';
export { createMainThreadReactionBackend } from './worker-boundary';
export type { ReactionBackend } from './worker-boundary';
export type {
  PredictInput,
  PredictOptions,
  PredictOutput,
  ReactionEngineError,
  HeuristicAbstainReason,
} from './types';
