import type { RuleConfidence } from '@/chemistry/reactions/types';

// Phase 06 §4.6 — ReactionResult.confidence (0..1) 산정.
export const HEURISTIC_CONFIDENCE = 0.25;

export function ruleConfidenceToScore(c: RuleConfidence): number {
  return c === 'high' ? 0.95 : c === 'medium' ? 0.7 : 0.4;
}
