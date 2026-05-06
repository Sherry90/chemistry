import { describe, it, expect } from 'vitest';
import { normalizeSmiles, normalizeInchi, normalizeFormula } from '@/engine/parser/index';

describe('input normalization', () => {
  it('normalizeSmiles trims and collapses whitespace', () => {
    const result = normalizeSmiles('  C C O  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('CCO');
  });

  it('normalizeSmiles returns InputEmpty for blank input', () => {
    const result = normalizeSmiles('  ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputEmpty');
  });

  it('normalizeSmiles returns InputTooLong for >2000 chars', () => {
    const result = normalizeSmiles('C'.repeat(2001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputTooLong');
  });

  it('normalizeInchi requires InChI= prefix', () => {
    const bad = normalizeInchi('1S/H2O/h1H2');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('InchiSyntax');
  });

  it('normalizeInchi accepts valid InChI prefix', () => {
    const result = normalizeInchi('InChI=1S/H2O/h1H2');
    expect(result.ok).toBe(true);
  });

  it('normalizeFormula returns InputEmpty for blank', () => {
    const result = normalizeFormula('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputEmpty');
  });
});
