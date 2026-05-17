import type { PredictInput, PredictOptions, PredictOutput } from './types';
import { predict } from './predict';

// Phase 06 §5.7 / P3 — phase-03 RdkitBackend 와 별개의 병렬 boundary.
// 본 Phase 는 main-thread 구현만 제공. Worker 구현은 Phase 14.
export interface ReactionBackend {
  predict(input: PredictInput, opts?: PredictOptions): Promise<PredictOutput>;
}

export function createMainThreadReactionBackend(): ReactionBackend {
  return {
    predict(input, opts) {
      return predict(input, opts);
    },
  };
}
