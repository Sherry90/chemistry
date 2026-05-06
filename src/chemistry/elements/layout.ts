import type { Element } from './types';
import { getAllElements } from './registry';

export interface PeriodicTableCell {
  readonly element: Element;
  readonly row: number;
  readonly column: number;
}

function buildStandardLayout(elements: readonly Element[]): readonly PeriodicTableCell[] {
  const cells: PeriodicTableCell[] = [];

  // Row 1: H(col 1), He(col 18)
  const row1Groups: Array<[number, number]> = [
    [1, 1],
    [18, 2],
  ];
  for (const [col, n] of row1Groups) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 1, column: col });
  }

  // Rows 2–3 (8-element periods)
  const row2Numbers = [3, 4, 5, 6, 7, 8, 9, 10]; // col: 1,2,13,14,15,16,17,18
  const row3Numbers = [11, 12, 13, 14, 15, 16, 17, 18];
  const shortPeriodCols = [1, 2, 13, 14, 15, 16, 17, 18];
  for (const [i, n] of row2Numbers.entries()) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 2, column: shortPeriodCols[i] as number });
  }
  for (const [i, n] of row3Numbers.entries()) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 3, column: shortPeriodCols[i] as number });
  }

  // Row 4: K(19)–Kr(36), cols 1–18
  for (let n = 19, col = 1; n <= 36; n++, col++) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 4, column: col });
  }

  // Row 5: Rb(37)–Xe(54), cols 1–18
  for (let n = 37, col = 1; n <= 54; n++, col++) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 5, column: col });
  }

  // Row 6: Cs(55,col1), Ba(56,col2), [col3 empty - La in row8], Hf(72,col4)..Rn(86,col18)
  const row6Main: Array<[number, number]> = [
    [55, 1],
    [56, 2],
    ...Array.from({ length: 15 }, (_, i) => [72 + i, 4 + i] as [number, number]),
  ];
  for (const [n, col] of row6Main) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 6, column: col });
  }

  // Row 7: Fr(87,col1), Ra(88,col2), [col3 empty - Ac in row9], Rf(104,col4)..Og(118,col18)
  const row7Main: Array<[number, number]> = [
    [87, 1],
    [88, 2],
    ...Array.from({ length: 15 }, (_, i) => [104 + i, 4 + i] as [number, number]),
  ];
  for (const [n, col] of row7Main) {
    const el = elements.find((e) => e.number === n);
    if (el) cells.push({ element: el, row: 7, column: col });
  }

  // Row 8: La(57,col3)..Lu(71,col17) — lanthanides
  for (let i = 0; i < 15; i++) {
    const el = elements.find((e) => e.number === 57 + i);
    if (el) cells.push({ element: el, row: 8, column: 3 + i });
  }

  // Row 9: Ac(89,col3)..Lr(103,col17) — actinides
  for (let i = 0; i < 15; i++) {
    const el = elements.find((e) => e.number === 89 + i);
    if (el) cells.push({ element: el, row: 9, column: 3 + i });
  }

  return cells;
}

function buildExtendedLayout(elements: readonly Element[]): readonly PeriodicTableCell[] {
  const cells: PeriodicTableCell[] = [];

  // Row 1: H(col 1), He(col 32)
  const h = elements.find((e) => e.number === 1);
  const he = elements.find((e) => e.number === 2);
  if (h) cells.push({ element: h, row: 1, column: 1 });
  if (he) cells.push({ element: he, row: 1, column: 32 });

  // Extended 32-column layout: groups mapped as s=1-2, f=3-16, d=17-26, p=27-32
  // Groups 1-2 → cols 1-2; Groups 3-12 → cols 17-26; groups 13-18 → cols 27-32
  // f-block (lanthanides/actinides) → cols 3-16
  // Use simple column assignment via group number mapping:

  const groupToCol32: Record<number, number> = {};
  for (let g = 1; g <= 2; g++) groupToCol32[g] = g;
  for (let g = 3; g <= 12; g++) groupToCol32[g] = g + 14; // 17-26
  for (let g = 13; g <= 18; g++) groupToCol32[g] = g + 14; // 27-32

  for (const el of elements) {
    if (el.group !== null) {
      const col = groupToCol32[el.group];
      if (col !== undefined) {
        cells.push({ element: el, row: el.period, column: col });
      }
    } else if (el.category === 'lanthanide') {
      // La(57) is at period 6, col 3+offset from Ce
      // La→col3, Ce→col4, ...Lu→col17
      const offset = el.number <= 71 ? el.number - 57 : 0;
      cells.push({ element: el, row: 6, column: 3 + offset });
    } else if (el.category === 'actinide') {
      const offset = el.number <= 103 ? el.number - 89 : 0;
      cells.push({ element: el, row: 7, column: 3 + offset });
    }
  }

  return cells;
}

export function getPeriodicTableLayout(
  mode: 'standard' | 'extended' = 'standard',
): readonly PeriodicTableCell[] {
  const elements = getAllElements();
  return mode === 'standard' ? buildStandardLayout(elements) : buildExtendedLayout(elements);
}
