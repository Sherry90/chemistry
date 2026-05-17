import type { ReactionRule, ReactionResult, ThermoFlag } from '@/chemistry/reactions/types';

// Phase 06 §6.6 — U3: 정량 ΔH 없음. 우선순위: 매칭 규칙 → 휴리스틱 → unknown.
export function decideThermo(
  matched: ReactionRule | null,
  heuristic: ReactionResult | null,
): ThermoFlag {
  if (matched) return matched.thermo;
  if (heuristic) return heuristic.thermo;
  return 'unknown';
}
