import { describe, it, expect } from 'vitest';
import { getCompoundManifest, loadCompoundChunk } from '@/data/compounds/index';
import { ALL_COMPOUND_CATEGORIES } from '@/chemistry/compounds/categories';
import { isValidElementNumber } from '@/chemistry/elements';

describe('manifest integrity', () => {
  it('version is a valid ISO 8601 string', () => {
    const { version } = getCompoundManifest();
    expect(() => new Date(version).toISOString()).not.toThrow();
  });

  it('all 14 CompoundCategory keys are present in categories', () => {
    const { categories } = getCompoundManifest();
    for (const cat of ALL_COMPOUND_CATEGORIES) {
      expect(categories).toHaveProperty(cat);
    }
    expect(Object.keys(categories).length).toBe(ALL_COMPOUND_CATEGORIES.length);
  });

  it('each entry.chunk is listed in categories[entry.category].chunks', () => {
    const manifest = getCompoundManifest();
    for (const entry of manifest.entries) {
      const cat = manifest.categories[entry.category];
      expect(cat).toBeDefined();
      expect(cat?.chunks).toContain(entry.chunk);
    }
  });

  it('categories count fields sum to totalCompounds', () => {
    const manifest = getCompoundManifest();
    const total = Object.values(manifest.categories).reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(manifest.totalCompounds);
  });

  it('entries are sorted by priority ASC, then cid ASC', () => {
    const { entries } = getCompoundManifest();
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]!;
      const curr = entries[i]!;
      if (prev.priority === curr.priority) {
        expect(prev.cid).toBeLessThanOrEqual(curr.cid);
      } else {
        expect(prev.priority).toBeLessThan(curr.priority);
      }
    }
  });

  it('all entries have non-empty searchTokens', () => {
    for (const entry of getCompoundManifest().entries) {
      expect(entry.searchTokens.length).toBeGreaterThan(0);
    }
  });

  it('inchiKey format looks valid (26 chars with hyphens)', () => {
    for (const entry of getCompoundManifest().entries) {
      expect(entry.inchiKey).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]$/);
    }
  });
});

describe('chunk integrity', () => {
  it('inorganic-common chunk entries are sorted by CID ascending', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    for (let i = 1; i < compounds.length; i++) {
      const prev = compounds[i - 1]!;
      const curr = compounds[i]!;
      expect(prev.cid ?? 0).toBeLessThan(curr.cid ?? 0);
    }
  });

  it('all chunk entries have category inorganic-common', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    for (const c of compounds) {
      expect(c.category).toBe('inorganic-common');
    }
  });

  it('all atoms have valid elementNumber', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    for (const compound of compounds) {
      if (!compound.defaultMolecule) continue;
      for (const atom of compound.defaultMolecule.atoms) {
        expect(isValidElementNumber(atom.elementNumber)).toBe(true);
      }
    }
  });

  it('all entries have non-null cid', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    for (const c of compounds) {
      expect(c.cid).not.toBeNull();
    }
  });

  it('defaultMolecule id follows "cid:{CID}" pattern', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    for (const c of compounds) {
      if (!c.defaultMolecule) continue;
      expect(c.defaultMolecule.id).toBe(`cid:${c.cid}`);
    }
  });

  it('water has expected molecular formula and SMILES', async () => {
    const compounds = await loadCompoundChunk('inorganic-common.json');
    const water = compounds.find((c) => c.cid === 962);
    expect(water).toBeDefined();
    expect(water?.molecularFormula).toBe('H2O');
    expect(water?.smiles).toBe('O');
  });
});
