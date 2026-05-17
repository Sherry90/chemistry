import { describe, it, expect } from 'vitest';
import { cpkColorOf, bondSplitColors, hexToRgb01 } from '@/viewport/_shared/colors';
import { getElement } from '@/chemistry/elements';
import type { ElementNumber } from '@/chemistry/elements/types';

const E = (n: number) => n as ElementNumber;

describe('viewport colors', () => {
  it('cpkColorOf matches Element.cpkColorHex', () => {
    expect(cpkColorOf(E(6))).toBe(getElement(E(6)).cpkColorHex);
    expect(cpkColorOf(E(8))).toBe(getElement(E(8)).cpkColorHex);
  });

  it('bondSplitColors: C-O is two-color', () => {
    const r = bondSplitColors(E(6), E(8));
    expect(r.single).toBe(false);
    expect(r.a).toBe(getElement(E(6)).cpkColorHex);
    expect(r.b).toBe(getElement(E(8)).cpkColorHex);
  });

  it('bondSplitColors: C-C is single', () => {
    expect(bondSplitColors(E(6), E(6)).single).toBe(true);
  });

  it('hexToRgb01 normalizes', () => {
    expect(hexToRgb01('#FF0000')).toEqual([1, 0, 0]);
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0]);
  });
});
