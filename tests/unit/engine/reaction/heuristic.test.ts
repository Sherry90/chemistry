import { describe, it, expect } from 'vitest';
import { tryHeuristic } from '@/engine/reaction/heuristic';
import { molecule, atom } from './helpers';

describe('tryHeuristic abstain paths (no RDKit needed)', () => {
  it('element outside oxidation table → electronegativity-data-missing', async () => {
    // Na(11): electronegativity exists but valence lookup misses → abstain.
    const r = await tryHeuristic({
      reactants: [molecule({ atoms: [atom(11)] })],
      condition: { temperatureK: 298, pressureAtm: 1, pH: null },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('HeuristicAbstained');
      if (r.error.kind === 'HeuristicAbstained') {
        expect(r.error.reason).toBe('electronegativity-data-missing');
      }
    }
  });

  it('single saturated reactant → no-candidate-pair', async () => {
    const ch4 = molecule({ atoms: [atom(6, { implicitHCount: 4 })] });
    const r = await tryHeuristic({
      reactants: [ch4],
      condition: { temperatureK: 298, pressureAtm: 1, pH: null },
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'HeuristicAbstained') {
      expect(r.error.reason).toBe('no-candidate-pair');
    }
  });

  it('more than 2 candidate pairs → too-many-bond-changes', async () => {
    const a = molecule({ atoms: [atom(8), atom(8), atom(8)] }); // 3 unsaturated O
    const b = molecule({ atoms: [atom(1), atom(1), atom(1)] }); // 3 unsaturated H
    const r = await tryHeuristic({
      reactants: [a, b],
      condition: { temperatureK: 298, pressureAtm: 1, pH: null },
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'HeuristicAbstained') {
      expect(r.error.reason).toBe('too-many-bond-changes');
    }
  });
});
