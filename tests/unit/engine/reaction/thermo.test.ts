import { describe, it, expect } from 'vitest';
import { decideThermo } from '@/engine/reaction/thermo';
import { rule } from './helpers';
import type { ReactionResult } from '@/chemistry/reactions/types';

const heuristicResult = (thermo: ReactionResult['thermo']): ReactionResult => ({
  products: [],
  kind: 'heuristic-experimental',
  appliedRuleId: null,
  thermo,
  notes: null,
  confidence: 0.25,
});

describe('decideThermo priority', () => {
  it('matched rule wins', () => {
    expect(decideThermo(rule({ thermo: 'exothermic' }), heuristicResult('endothermic'))).toBe(
      'exothermic',
    );
  });
  it('heuristic when no match', () => {
    expect(decideThermo(null, heuristicResult('endothermic'))).toBe('endothermic');
  });
  it('unknown when neither', () => {
    expect(decideThermo(null, null)).toBe('unknown');
  });
});
