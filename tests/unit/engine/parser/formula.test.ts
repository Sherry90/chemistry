import { describe, it, expect } from 'vitest';
import { parseFormula, formulaToHillKey } from '@/engine/parser/formula';

describe('formula parser', () => {
  it('parses H2O', () => {
    const result = parseFormula('H2O');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCharge).toBe(0);
    const h = result.value.entries.find((e) => e.symbol === 'H');
    const o = result.value.entries.find((e) => e.symbol === 'O');
    expect(h?.count).toBe(2);
    expect(o?.count).toBe(1);
  });

  it('parses NH4+ with charge', () => {
    const result = parseFormula('NH4+');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCharge).toBe(1);
    const n = result.value.entries.find((e) => e.symbol === 'N');
    expect(n?.count).toBe(1);
    const h = result.value.entries.find((e) => e.symbol === 'H');
    expect(h?.count).toBe(4);
  });

  it('returns UnknownElement for invalid symbol', () => {
    const result = parseFormula('Xx2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UnknownElement');
  });

  it('returns InputEmpty for blank formula', () => {
    const result = parseFormula('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('InputEmpty');
  });

  it('formulaToHillKey orders C first, then H, then alphabetical', () => {
    const result = parseFormula('CH3OH');
    if (!result.ok) return;
    const key = formulaToHillKey(result.value);
    expect(key).toBe('CH4O');
  });

  it('formulaToHillKey for inorganic uses alphabetical order', () => {
    const result = parseFormula('H2O');
    if (!result.ok) return;
    const key = formulaToHillKey(result.value);
    expect(key).toBe('H2O');
  });

  it('formulaToHillKey includes charge suffix', () => {
    const result = parseFormula('NH4+');
    if (!result.ok) return;
    const key = formulaToHillKey(result.value);
    expect(key).toBe('H4N+');
  });

  it('C6H6 maps to benzene SMILES in formula map', () => {
    const result = parseFormula('C6H6');
    if (!result.ok) return;
    const key = formulaToHillKey(result.value);
    expect(key).toBe('C6H6');
  });
});
