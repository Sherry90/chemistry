import { describe, it, expect } from 'vitest';
import {
  getElement,
  getElementUnsafe,
  getElementBySymbol,
  getElementsByPeriod,
  getElementsByGroup,
  getElementsByBlock,
  getElementsByCategory,
  elementSymbolOf,
  elementNameOf,
  isValidElementNumber,
} from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements';

const asEN = (n: number) => n as ElementNumber;

describe('element registry API', () => {
  it('getElement returns element for valid number', () => {
    const el = getElement(asEN(6));
    expect(el.symbol).toBe('C');
  });

  it('getElement throws for invalid number', () => {
    expect(() => getElement(asEN(0))).toThrow();
    expect(() => getElement(asEN(119))).toThrow();
  });

  it('getElementUnsafe returns undefined for invalid number', () => {
    expect(getElementUnsafe(0)).toBeUndefined();
    expect(getElementUnsafe(119)).toBeUndefined();
  });

  it('getElementUnsafe returns element for valid number', () => {
    expect(getElementUnsafe(1)?.symbol).toBe('H');
  });

  it('getElementBySymbol is case-sensitive', () => {
    expect(getElementBySymbol('Fe')).toBeDefined();
    expect(getElementBySymbol('fe')).toBeUndefined();
    expect(getElementBySymbol('FE')).toBeUndefined();
  });

  it('getElementsByPeriod(1) returns H and He', () => {
    const p1 = getElementsByPeriod(1);
    expect(p1).toHaveLength(2);
    const symbols = p1.map((e) => e.symbol);
    expect(symbols).toContain('H');
    expect(symbols).toContain('He');
  });

  it('getElementsByGroup(18) returns 7 noble gases', () => {
    const g18 = getElementsByGroup(18);
    expect(g18).toHaveLength(7);
    for (const el of g18) {
      expect(el.group).toBe(18);
    }
  });

  it('getElementsByBlock("f") returns 28 elements', () => {
    const fBlock = getElementsByBlock('f');
    expect(fBlock).toHaveLength(28);
  });

  it('getElementsByBlock("d") returns 40 elements (includes La, Ac)', () => {
    const dBlock = getElementsByBlock('d');
    expect(dBlock).toHaveLength(40);
    const symbols = dBlock.map((e) => e.symbol);
    expect(symbols).toContain('La');
    expect(symbols).toContain('Ac');
  });

  it('getElementsByCategory("lanthanide") returns 15 elements', () => {
    const lanthanides = getElementsByCategory('lanthanide');
    expect(lanthanides).toHaveLength(15);
  });

  it('getElementsByCategory("actinide") returns 15 elements', () => {
    const actinides = getElementsByCategory('actinide');
    expect(actinides).toHaveLength(15);
  });

  it('elementSymbolOf returns correct symbol', () => {
    expect(elementSymbolOf(asEN(1))).toBe('H');
    expect(elementSymbolOf(asEN(79))).toBe('Au');
  });

  it('elementNameOf returns English name', () => {
    expect(elementNameOf(asEN(1), 'en')).toBe('Hydrogen');
    expect(elementNameOf(asEN(79), 'en')).toBe('Gold');
  });

  it('elementNameOf returns Korean name', () => {
    expect(elementNameOf(asEN(1), 'ko')).toBe('수소');
    expect(elementNameOf(asEN(79), 'ko')).toBe('금');
  });

  it('isValidElementNumber rejects out-of-range', () => {
    expect(isValidElementNumber(0)).toBe(false);
    expect(isValidElementNumber(119)).toBe(false);
    expect(isValidElementNumber(1)).toBe(true);
    expect(isValidElementNumber(118)).toBe(true);
  });
});
