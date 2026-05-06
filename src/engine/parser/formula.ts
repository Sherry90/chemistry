import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type { ParseError } from './errors';
import { getElementBySymbol } from '@/chemistry/elements';

export interface FormulaEntry {
  readonly symbol: string;
  readonly count: number;
}

export interface FormulaComposition {
  readonly entries: ReadonlyArray<FormulaEntry>;
  readonly totalCharge: number;
}

export function parseFormula(input: string): Result<FormulaComposition, ParseError> {
  const trimmed = input.trim().replace(/\s+/g, '');
  if (trimmed.length === 0) {
    return err({ code: 'InputEmpty', message: 'Formula input is empty' });
  }

  const entries: FormulaEntry[] = [];
  const tokenRe = /([A-Z][a-z]?)(\d*)/g;
  let match: RegExpExecArray | null;
  let consumed = 0;

  // Parse element-count pairs from left
  while ((match = tokenRe.exec(trimmed)) !== null) {
    if (match.index !== consumed) break; // gap found — stop and handle as charge tail
    const full = match[0] ?? '';
    const symbol = match[1] ?? '';
    const countStr = match[2] ?? '';
    if (!full) break;
    consumed += full.length;
    const count = countStr ? parseInt(countStr, 10) : 1;

    if (!symbol || !getElementBySymbol(symbol)) {
      return err({ code: 'UnknownElement', message: `Unknown element symbol: ${symbol}` });
    }

    const existing = entries.find((e) => e.symbol === symbol);
    if (existing) {
      entries[entries.indexOf(existing)] = { symbol, count: existing.count + count };
    } else {
      entries.push({ symbol, count });
    }
  }

  if (entries.length === 0) {
    return err({ code: 'InputEmpty', message: 'No elements found in formula' });
  }

  // Parse charge from remainder
  const tail = trimmed.slice(consumed);
  let totalCharge = 0;

  if (tail.length > 0) {
    // Accepted charge formats: "+", "-", "+2", "-2", "2+", "2-"
    const chargeRe = /^([+-])(\d*)$|^(\d+)([+-])$/.exec(tail);
    if (!chargeRe) {
      return err({
        code: 'FormulaSyntax',
        message: `Unexpected characters after formula: "${tail}"`,
        at: consumed + 1,
      });
    }
    if (chargeRe[1] !== undefined) {
      // Format "+n" or "-n"
      const sign = chargeRe[1] === '+' ? 1 : -1;
      const mag = chargeRe[2] ? parseInt(chargeRe[2], 10) : 1;
      totalCharge = sign * mag;
    } else {
      // Format "n+" or "n-"
      const mag = chargeRe[3] ? parseInt(chargeRe[3], 10) : 1;
      const sign = chargeRe[4] === '+' ? 1 : -1;
      totalCharge = sign * mag;
    }
  }

  return ok({ entries, totalCharge });
}

export function formulaToHillKey(comp: FormulaComposition): string {
  const sorted = [...comp.entries];
  const hasCarbon = sorted.some((e) => e.symbol === 'C');

  if (hasCarbon) {
    sorted.sort((a, b) => {
      if (a.symbol === 'C') return -1;
      if (b.symbol === 'C') return 1;
      if (a.symbol === 'H') return -1;
      if (b.symbol === 'H') return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  } else {
    sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  let key = sorted.map((e) => `${e.symbol}${e.count === 1 ? '' : e.count}`).join('');

  const charge = comp.totalCharge;
  if (charge !== 0) {
    if (charge === 1) key += '+';
    else if (charge === -1) key += '-';
    else if (charge > 0) key += `${charge}+`;
    else key += `${Math.abs(charge)}-`;
  }

  return key;
}
