import { describe, it, expect } from 'vitest';
import { getAllElements, isValidElementNumber } from '@/chemistry/elements';

describe('elements data integrity', () => {
  const elements = getAllElements();

  it('has exactly 118 elements', () => {
    expect(elements).toHaveLength(118);
  });

  it('numbers are unique and sequential 1–118', () => {
    const numbers = elements.map((e) => e.number);
    expect(new Set(numbers).size).toBe(118);
    for (let i = 0; i < 118; i++) {
      expect(numbers[i]).toBe(i + 1);
    }
  });

  it('symbols are unique and non-empty', () => {
    const symbols = elements.map((e) => e.symbol);
    expect(new Set(symbols).size).toBe(118);
    for (const sym of symbols) {
      expect(sym.length).toBeGreaterThan(0);
    }
  });

  it('atomicMass > 0 for all elements', () => {
    for (const el of elements) {
      expect(el.atomicMass).toBeGreaterThan(0);
    }
  });

  it('period is in [1,7]', () => {
    for (const el of elements) {
      expect(el.period).toBeGreaterThanOrEqual(1);
      expect(el.period).toBeLessThanOrEqual(7);
    }
  });

  it('melting point ≤ boiling point when both defined', () => {
    for (const el of elements) {
      if (el.meltingPointK !== null && el.boilingPointK !== null) {
        expect(el.meltingPointK).toBeLessThanOrEqual(el.boilingPointK);
      }
    }
  });

  it('synthetic elements are radioactive', () => {
    for (const el of elements) {
      if (el.occurrence === 'synthetic') {
        expect(el.isRadioactive).toBe(true);
      }
    }
  });

  it('cpkColorHex starts with #', () => {
    for (const el of elements) {
      expect(el.cpkColorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('block is one of s p d f', () => {
    const validBlocks = new Set(['s', 'p', 'd', 'f']);
    for (const el of elements) {
      expect(validBlocks.has(el.block)).toBe(true);
    }
  });

  it('isValidElementNumber rejects out-of-range', () => {
    expect(isValidElementNumber(0)).toBe(false);
    expect(isValidElementNumber(119)).toBe(false);
    expect(isValidElementNumber(1)).toBe(true);
    expect(isValidElementNumber(118)).toBe(true);
  });
});
