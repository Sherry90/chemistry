import { describe, it, expect } from 'vitest';
import { ruleConfidenceToScore, HEURISTIC_CONFIDENCE } from '@/engine/reaction/confidence';

describe('confidence mapping', () => {
  it('RuleConfidence enum → 0..1 score', () => {
    expect(ruleConfidenceToScore('high')).toBe(0.95);
    expect(ruleConfidenceToScore('medium')).toBe(0.7);
    expect(ruleConfidenceToScore('low')).toBe(0.4);
  });
  it('HEURISTIC_CONFIDENCE fixed', () => {
    expect(HEURISTIC_CONFIDENCE).toBe(0.25);
    expect(HEURISTIC_CONFIDENCE).toBeGreaterThan(0);
    expect(HEURISTIC_CONFIDENCE).toBeLessThan(1);
  });
});
