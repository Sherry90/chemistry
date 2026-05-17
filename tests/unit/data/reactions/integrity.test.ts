import { describe, it, expect } from 'vitest';
import {
  getReactionManifest,
  loadReactionChunk,
  searchRulesManifest,
  allReactionCategoriesPresent,
} from '@/data/reactions';
import { ALL_RULE_CATEGORIES, ALL_REACTION_RULE_LICENSES } from '@/chemistry/reactions/types';

describe('reaction manifest integrity', () => {
  it('version is valid ISO 8601', () => {
    expect(() => new Date(getReactionManifest().version).toISOString()).not.toThrow();
  });

  it('all RuleCategory keys present', () => {
    expect(allReactionCategoriesPresent()).toBe(true);
    const cats = getReactionManifest().categories;
    for (const c of ALL_RULE_CATEGORIES) expect(cats).toHaveProperty(c);
  });

  it('totalRules equals entries length and category counts sum', () => {
    const m = getReactionManifest();
    expect(m.entries.length).toBe(m.totalRules);
    const sum = ALL_RULE_CATEGORIES.reduce((s, c) => s + m.categories[c].count, 0);
    expect(sum).toBe(m.totalRules);
  });

  it('every chunk version matches manifest version; rule.version too', async () => {
    const m = getReactionManifest();
    for (const c of ALL_RULE_CATEGORIES) {
      const rules = await loadReactionChunk(c);
      for (const r of rules) expect(r.version).toBe(m.version);
    }
  });

  it('licenseSummary licenses are whitelisted and counts match totalRules', () => {
    const m = getReactionManifest();
    let sum = 0;
    for (const ls of m.licenseSummary) {
      expect(ALL_REACTION_RULE_LICENSES).toContain(ls.license);
      sum += ls.count;
    }
    expect(sum).toBe(m.totalRules);
  });

  it('every entry.chunk equals categories[entry.category].chunk', () => {
    const m = getReactionManifest();
    for (const e of m.entries) {
      expect(e.chunk).toBe(m.categories[e.category].chunk);
    }
  });

  it('searchRulesManifest returns priority-asc, id-asc order', () => {
    const out = searchRulesManifest({});
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      expect(a.priority < b.priority || (a.priority === b.priority && a.id <= b.id)).toBe(true);
    }
  });
});
