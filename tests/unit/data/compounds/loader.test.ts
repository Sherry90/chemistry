import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCompoundManifest,
  loadCompoundChunk,
  findCompoundByCid,
  findCompoundByInchiKey,
  searchCompoundManifest,
  resetCompoundCache,
} from '@/data/compounds/index';

beforeEach(() => {
  resetCompoundCache();
  vi.restoreAllMocks();
});

describe('getCompoundManifest', () => {
  it('returns an object with version, totalCompounds, categories, entries', () => {
    const m = getCompoundManifest();
    expect(typeof m.version).toBe('string');
    expect(typeof m.totalCompounds).toBe('number');
    expect(m.categories).toBeDefined();
    expect(Array.isArray(m.entries)).toBe(true);
  });

  it('returns the same reference on repeated calls (memoized)', () => {
    expect(getCompoundManifest()).toBe(getCompoundManifest());
  });

  it('has all 14 required categories', () => {
    const m = getCompoundManifest();
    const expected = [
      'inorganic-common',
      'salts-and-ions',
      'acids-and-bases',
      'alkanes',
      'alkenes-alkynes',
      'alcohols',
      'carboxylic-acids-esters',
      'aldehydes-ketones',
      'amines-amides',
      'aromatics',
      'heterocycles',
      'biomolecules-basic',
      'pharma-illustrative',
      'everyday-compounds',
    ];
    for (const cat of expected) {
      expect(m.categories).toHaveProperty(cat);
    }
  });

  it('totalCompounds matches sum of category counts', () => {
    const m = getCompoundManifest();
    const sum = Object.values(m.categories).reduce((acc, cat) => acc + cat.count, 0);
    expect(m.totalCompounds).toBe(sum);
  });

  it('totalCompounds matches entries array length', () => {
    const m = getCompoundManifest();
    expect(m.totalCompounds).toBe(m.entries.length);
  });
});

describe('loadCompoundChunk', () => {
  it('returns an array for a valid chunk', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    expect(Array.isArray(compounds)).toBe(true);
    expect(compounds.length).toBeGreaterThan(0);
  });

  it('rejects with error for unknown chunk', async () => {
    await expect(loadCompoundChunk('nonexistent.json')).rejects.toThrow('Unknown chunk');
  });

  it('caches result — second call returns same promise data', async () => {
    const first = await loadCompoundChunk('inorganic-common.json');
    const second = await loadCompoundChunk('inorganic-common.json');
    expect(first).toBe(second);
  });
});

describe('findCompoundByCid', () => {
  it('returns Water for CID 962', async () => {
    const compound = await findCompoundByCid(962);
    expect(compound).not.toBeNull();
    expect(compound?.name.en).toBe('Water');
    expect(compound?.molecularFormula).toBe('H2O');
  });

  it('returns null for unknown CID', async () => {
    const compound = await findCompoundByCid(-1);
    expect(compound).toBeNull();
  });

  it('returns Carbon dioxide for CID 280', async () => {
    const compound = await findCompoundByCid(280);
    expect(compound?.name.ko).toBe('이산화탄소');
  });
});

describe('findCompoundByInchiKey', () => {
  it('finds water by InChIKey', async () => {
    const compound = await findCompoundByInchiKey('XLYOFNOQVPJJNP-UHFFFAOYSA-N');
    expect(compound).not.toBeNull();
    expect(compound?.cid).toBe(962);
  });

  it('returns null for unknown InChIKey', async () => {
    const compound = await findCompoundByInchiKey('AAAAAAAAAA-BBBBBBBBBB-C');
    expect(compound).toBeNull();
  });
});

describe('searchCompoundManifest', () => {
  it('returns Water when searching "wat"', () => {
    const results = searchCompoundManifest({ query: 'wat', limit: 5 });
    expect(results.some((r) => r.cid === 962)).toBe(true);
  });

  it('returns Water when searching Korean "물"', () => {
    const results = searchCompoundManifest({ query: '물' });
    expect(results.some((r) => r.cid === 962)).toBe(true);
  });

  it('returns Water first when searching "water" (exact match)', () => {
    const results = searchCompoundManifest({ query: 'water' });
    expect(results[0]?.cid).toBe(962);
  });

  it('returns results sorted by priority when query is empty', () => {
    const results = searchCompoundManifest({ query: '', limit: 10 });
    for (let i = 1; i < results.length; i++) {
      expect((results[i - 1]?.priority ?? 0) <= (results[i]?.priority ?? 0)).toBe(true);
    }
  });

  it('respects limit', () => {
    const results = searchCompoundManifest({ query: '', limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('filters by category', () => {
    const results = searchCompoundManifest({ query: '', categories: ['alkanes'] });
    expect(results.every((r) => r.category === 'alkanes')).toBe(true);
  });

  it('returns empty array when no match', () => {
    const results = searchCompoundManifest({ query: 'xyzzy_no_match_ever' });
    expect(results).toHaveLength(0);
  });

  it('empty categories array means all categories', () => {
    const withEmpty = searchCompoundManifest({ query: '', categories: [] });
    const withUndefined = searchCompoundManifest({ query: '' });
    expect(withEmpty.length).toBe(withUndefined.length);
  });
});
