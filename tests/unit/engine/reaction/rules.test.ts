import { describe, it, expect } from 'vitest';
import {
  prefilterCandidates,
  searchManifestEntries,
  loadRulesByIds,
} from '@/engine/reaction/rules';
import { molecule, atom, condition } from './helpers';

const withElems = (...nums: number[]) => molecule({ atoms: nums.map((n) => atom(n)) });

describe('prefilterCandidates', () => {
  it('pH defined + H,O,Cl present → acid-base candidate included', () => {
    const out = prefilterCandidates([withElems(1, 8, 17)], condition({ pH: 7 }));
    expect(out.map((e) => e.id)).toContain('ab-strong-acid-hydroxide');
  });

  it('pH null → requiresPh rule excluded', () => {
    const out = prefilterCandidates([withElems(1, 8, 17)], condition({ pH: null }));
    expect(out.map((e) => e.id)).not.toContain('ab-strong-acid-hydroxide');
  });

  it('missing required element → rule excluded', () => {
    // H,O only: redox(req 1,8) ok; ab needs 17; est needs 6.
    const out = prefilterCandidates([withElems(1, 8)], condition({ pH: 7 }));
    const ids = out.map((e) => e.id);
    expect(ids).toContain('redox-h2-o2-water');
    expect(ids).not.toContain('est-fischer');
  });

  it('deterministic order: priority asc → id asc', () => {
    const out = prefilterCandidates([withElems(1, 6, 8, 17)], condition({ pH: 7 }));
    const keys = out.map((e) => `${e.priority}:${e.id}`);
    const sorted = [...keys].sort((a, b) => {
      const [pa, ia] = a.split(':');
      const [pb, ib] = b.split(':');
      return pa !== pb ? Number(pa) - Number(pb) : ia!.localeCompare(ib!);
    });
    expect(keys).toEqual(sorted);
  });
});

describe('searchManifestEntries / loadRulesByIds', () => {
  it('category filter', () => {
    const out = searchManifestEntries({ categories: ['simple-redox'] });
    expect(out.every((e) => e.category === 'simple-redox')).toBe(true);
  });

  it('loadRulesByIds returns full rule bodies', async () => {
    const rules = await loadRulesByIds(['redox-h2-o2-water']);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.smarts).toContain('>>');
    expect(rules[0]!.license).toBe('in-house');
  });

  it('loadRulesByIds empty input → empty', async () => {
    expect(await loadRulesByIds([])).toEqual([]);
  });
});
