import { ok, err } from '@/types/result';
import { logger } from '@/utils/logger';
import { ensureRdkit, getRdkitStatus } from '@/engine/rdkit/service';
import type { PredictInput, PredictOptions, PredictOutput } from './types';
import { tryHeuristic } from './heuristic';
import { getReactionManifest } from '@/data/reactions';
import { reactionCacheKey, getCachedResult, setCachedResult } from './cache';

function validateInput(input: PredictInput): ReadonlyArray<string> {
  const issues: string[] = [];
  if (!input.reactants || input.reactants.length === 0) {
    issues.push('reactants must be a non-empty array');
  } else {
    input.reactants.forEach((m, i) => {
      if (!m.atoms || m.atoms.length === 0) issues.push(`reactant[${i}] has no atoms`);
    });
  }
  return issues;
}

// Phase 06 §6.1 — predict 파이프라인.
// ⚠️ v1: 규칙 기반 매칭(RunReactants)은 RDKit MinimalLib 반응 API 부재로 deferred.
//   파이프라인은 입력검증 → RDKit 준비 → 캐시 → (규칙 단계 생략) → 휴리스틱 순으로 진행한다.
export async function predict(input: PredictInput, opts?: PredictOptions): Promise<PredictOutput> {
  // ② AbortSignal — 진입 즉시.
  if (opts?.signal?.aborted) return err({ kind: 'Aborted', retryable: false });

  // ① 입력 검증.
  const issues = validateInput(input);
  if (issues.length > 0) {
    return err({ kind: 'InvalidReactant', issues, retryable: false });
  }

  // ③ RDKit 준비 (휴리스틱 product 임베드에 필요).
  try {
    await ensureRdkit();
  } catch {
    const st = getRdkitStatus();
    if (st.phase === 'error') {
      return err({ kind: 'RdkitInitFailed', cause: st.error, retryable: false });
    }
    return err({ kind: 'RdkitNotReady', retryable: true });
  }
  const status = getRdkitStatus();
  if (status.phase === 'error') {
    return err({ kind: 'RdkitInitFailed', cause: status.error, retryable: false });
  }
  if (status.phase !== 'ready') {
    return err({ kind: 'RdkitNotReady', retryable: true });
  }

  // ④ 캐시 (manifest.version 포함 키 — P8 stale 자동 무효).
  const version = getReactionManifest().version;
  const key = reactionCacheKey(input.reactants, input.condition, version);
  if (!opts?.force) {
    const cached = getCachedResult(key);
    if (cached) return ok(cached);
  }

  if (opts?.signal?.aborted) return err({ kind: 'Aborted', retryable: false });

  // ⑤ 규칙 매칭: DEFERRED (RDKit 반응 API 부재). → 휴리스틱으로 직행.
  // ⑥ 휴리스틱.
  logger.warn('reaction.predict.heuristicEnter', {
    reactantsSmiles: input.reactants.map((m) => m.canonicalSmiles),
  });
  const h = await tryHeuristic(input);
  if (h.ok) {
    setCachedResult(key, h.value);
    return ok(h.value);
  }

  switch (h.error.kind) {
    case 'HeuristicAbstained': {
      logger.warn('reaction.heuristic.abstain', { reason: h.error.reason });
      // abstain == 사용자에겐 "예측 불가". 규칙 단계 deferred 이므로 triedRuleIds 는 빈 배열.
      return err({ kind: 'NoMatchingRule', triedRuleIds: [], retryable: false });
    }
    case 'EmbedFailed':
      return err({ kind: 'EmbedFailed', ruleId: null, cause: h.error.cause, retryable: true });
    case 'Internal':
      return err({ kind: 'Internal', detail: h.error.detail, retryable: false });
  }
}
