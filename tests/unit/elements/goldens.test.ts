import { describe, it, expect } from 'vitest';
import { getElementUnsafe } from '@/chemistry/elements';

function el(n: number) {
  const element = getElementUnsafe(n);
  if (!element) throw new Error(`Element ${n} not found in registry`);
  return element;
}

describe('element golden values', () => {
  it('Hydrogen (Z=1)', () => {
    const H = el(1);
    expect(H.symbol).toBe('H');
    expect(H.nameEn).toBe('Hydrogen');
    expect(H.nameKo).toBe('수소');
    expect(H.period).toBe(1);
    expect(H.group).toBe(1);
    expect(H.block).toBe('s');
    expect(H.category).toBe('reactive-nonmetal');
    expect(H.standardState).toBe('gas');
    expect(H.isRadioactive).toBe(false);
    expect(H.occurrence).toBe('primordial');
    expect(H.atomicMass).toBeCloseTo(1.008, 2);
  });

  it('Carbon (Z=6)', () => {
    const C = el(6);
    expect(C.symbol).toBe('C');
    expect(C.nameEn).toBe('Carbon');
    expect(C.period).toBe(2);
    expect(C.group).toBe(14);
    expect(C.block).toBe('p');
    expect(C.category).toBe('reactive-nonmetal');
    expect(C.standardState).toBe('solid');
    expect(C.atomicMass).toBeCloseTo(12.011, 2);
  });

  it('Oxygen (Z=8)', () => {
    const O = el(8);
    expect(O.symbol).toBe('O');
    expect(O.nameEn).toBe('Oxygen');
    expect(O.period).toBe(2);
    expect(O.group).toBe(16);
    expect(O.block).toBe('p');
    expect(O.standardState).toBe('gas');
  });

  it('Iron (Z=26)', () => {
    const Fe = el(26);
    expect(Fe.symbol).toBe('Fe');
    expect(Fe.nameEn).toBe('Iron');
    expect(Fe.nameKo).toBe('철');
    expect(Fe.period).toBe(4);
    expect(Fe.group).toBe(8);
    expect(Fe.block).toBe('d');
    expect(Fe.category).toBe('transition-metal');
    expect(Fe.standardState).toBe('solid');
    expect(Fe.isRadioactive).toBe(false);
  });

  it('Gold (Z=79)', () => {
    const Au = el(79);
    expect(Au.symbol).toBe('Au');
    expect(Au.nameEn).toBe('Gold');
    expect(Au.nameKo).toBe('금');
    expect(Au.period).toBe(6);
    expect(Au.group).toBe(11);
    expect(Au.block).toBe('d');
    expect(Au.category).toBe('transition-metal');
    expect(Au.standardState).toBe('solid');
    expect(Au.atomicMass).toBeCloseTo(196.967, 2);
  });

  it('Lanthanum (Z=57) is d-block, category lanthanide, group null', () => {
    const La = el(57);
    expect(La.block).toBe('d');
    expect(La.category).toBe('lanthanide');
    expect(La.group).toBeNull();
  });

  it('Cerium (Z=58) is f-block, category lanthanide', () => {
    const Ce = el(58);
    expect(Ce.block).toBe('f');
    expect(Ce.category).toBe('lanthanide');
  });

  it('Uranium (Z=92) is radioactive f-block actinide', () => {
    const U = el(92);
    expect(U.block).toBe('f');
    expect(U.category).toBe('actinide');
    expect(U.isRadioactive).toBe(true);
    expect(U.atomicMass).toBeCloseTo(238.029, 2);
  });

  it('Oganesson (Z=118) is synthetic radioactive unknown-category', () => {
    const Og = el(118);
    expect(Og.symbol).toBe('Og');
    expect(Og.group).toBe(18);
    expect(Og.block).toBe('p');
    expect(Og.category).toBe('unknown');
    expect(Og.occurrence).toBe('synthetic');
    expect(Og.isRadioactive).toBe(true);
  });
});
