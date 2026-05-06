import { describe, it, expect, beforeEach } from 'vitest';
import { getParsedMol, setParsedMol, disposeCache } from '@/engine/rdkit/cache';
import { makeParsedMol } from './mock-backend';

beforeEach(() => {
  disposeCache();
});

describe('LRU parse cache', () => {
  it('returns undefined for cache miss', () => {
    expect(getParsedMol('smiles', 'CCO')).toBeUndefined();
  });

  it('returns value after set', () => {
    const mol = makeParsedMol({ canonicalSmiles: 'CCO' });
    setParsedMol('smiles', 'CCO', mol);
    expect(getParsedMol('smiles', 'CCO')).toBe(mol);
  });

  it('different keys do not collide', () => {
    const molA = makeParsedMol({ canonicalSmiles: 'A' });
    const molB = makeParsedMol({ canonicalSmiles: 'B' });
    setParsedMol('smiles', 'CCO', molA);
    setParsedMol('inchi', 'CCO', molB);
    expect(getParsedMol('smiles', 'CCO')?.canonicalSmiles).toBe('A');
    expect(getParsedMol('inchi', 'CCO')?.canonicalSmiles).toBe('B');
  });

  it('clears on disposeCache', () => {
    setParsedMol('smiles', 'CCO', makeParsedMol());
    disposeCache();
    expect(getParsedMol('smiles', 'CCO')).toBeUndefined();
  });

  it('evicts LRU entry at capacity 200', () => {
    // Fill 200 entries
    const mol = makeParsedMol();
    for (let i = 0; i < 200; i++) {
      setParsedMol('smiles', `mol-${i}`, mol);
    }
    // Access mol-0 to make it recently used
    getParsedMol('smiles', 'mol-0');
    // Insert 201st entry — should evict the LRU (mol-1, since mol-0 was accessed)
    setParsedMol('smiles', 'mol-200', mol);
    // mol-0 should still be there (recently accessed)
    expect(getParsedMol('smiles', 'mol-0')).toBeDefined();
    // mol-1 should be evicted
    expect(getParsedMol('smiles', 'mol-1')).toBeUndefined();
  });
});
