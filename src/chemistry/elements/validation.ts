import type { Result } from '@/types/result';
import { ok, err } from '@/types/result';
import type {
  Element,
  ElementNumber,
  Block,
  ElementCategory,
  StandardState,
  Occurrence,
} from './types';

const BLOCKS: ReadonlySet<string> = new Set(['s', 'p', 'd', 'f']);
const CATEGORIES: ReadonlySet<string> = new Set([
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'reactive-nonmetal',
  'noble-gas',
  'lanthanide',
  'actinide',
  'unknown',
]);
const STATES: ReadonlySet<string> = new Set(['solid', 'liquid', 'gas', 'unknown']);
const OCCURRENCES: ReadonlySet<string> = new Set(['primordial', 'from-decay', 'synthetic']);
const CPK_RE = /^#[0-9A-Fa-f]{6}$/;

function validateOne(raw: unknown, idx: number): string[] {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return [`[${idx}] not an object`];
  }
  const r = raw as Record<string, unknown>;

  if (
    typeof r['number'] !== 'number' ||
    !Number.isInteger(r['number']) ||
    (r['number'] as number) < 1 ||
    (r['number'] as number) > 118
  )
    errors.push(`[${idx}] invalid number: ${r['number']}`);
  if (typeof r['symbol'] !== 'string' || r['symbol'].length === 0)
    errors.push(`[${idx}] invalid symbol`);
  if (typeof r['nameEn'] !== 'string' || r['nameEn'].length === 0)
    errors.push(`[${idx}] invalid nameEn`);
  if (typeof r['nameKo'] !== 'string' || r['nameKo'].length === 0)
    errors.push(`[${idx}] invalid nameKo`);
  if (typeof r['atomicMass'] !== 'number' || (r['atomicMass'] as number) <= 0)
    errors.push(`[${idx}] invalid atomicMass`);
  if (typeof r['block'] !== 'string' || !BLOCKS.has(r['block'] as string))
    errors.push(`[${idx}] invalid block: ${r['block']}`);
  if (typeof r['category'] !== 'string' || !CATEGORIES.has(r['category'] as string))
    errors.push(`[${idx}] invalid category: ${r['category']}`);
  if (typeof r['standardState'] !== 'string' || !STATES.has(r['standardState'] as string))
    errors.push(`[${idx}] invalid standardState`);
  if (typeof r['occurrence'] !== 'string' || !OCCURRENCES.has(r['occurrence'] as string))
    errors.push(`[${idx}] invalid occurrence`);
  if (typeof r['isRadioactive'] !== 'boolean') errors.push(`[${idx}] invalid isRadioactive`);
  if (typeof r['cpkColorHex'] !== 'string' || !CPK_RE.test(r['cpkColorHex'] as string))
    errors.push(`[${idx}] invalid cpkColorHex: ${r['cpkColorHex']}`);
  const period = r['period'];
  if (typeof period !== 'number' || period < 1 || period > 7)
    errors.push(`[${idx}] invalid period: ${period}`);
  const mp = r['meltingPointK'];
  const bp = r['boilingPointK'];
  if (typeof mp === 'number' && typeof bp === 'number' && mp > bp)
    errors.push(`[${idx}] meltingPointK (${mp}) > boilingPointK (${bp})`);
  const iso = r['primaryIsotope'];
  if (typeof iso !== 'object' || iso === null) errors.push(`[${idx}] missing primaryIsotope`);
  else {
    const i = iso as Record<string, unknown>;
    if (
      typeof i['massNumber'] !== 'number' ||
      (i['massNumber'] as number) < (r['number'] as number)
    )
      errors.push(`[${idx}] primaryIsotope.massNumber < atomic number`);
  }
  return errors;
}

export function isValidElementNumber(n: number): n is ElementNumber {
  return Number.isInteger(n) && n >= 1 && n <= 118;
}

export function validateElementsPayload(raw: unknown): Result<readonly Element[], string[]> {
  if (!Array.isArray(raw)) return err(['payload is not an array']);
  if (raw.length !== 118) return err([`expected 118 elements, got ${raw.length}`]);

  const allErrors: string[] = [];
  raw.forEach((item, i) => {
    allErrors.push(...validateOne(item, i));
  });

  const numbers = raw.map((e: unknown) =>
    typeof e === 'object' && e !== null ? (e as Record<string, unknown>)['number'] : undefined,
  );
  const unique = new Set(numbers);
  if (unique.size !== 118) allErrors.push('duplicate atomic numbers detected');

  const sorted = [...numbers].every(
    (n, i) => i === 0 || (n as number) > (numbers[i - 1] as number),
  );
  if (!sorted) allErrors.push('elements not in ascending atomic number order');

  const syntheticNonRadioactive = raw.filter(
    (e: unknown) =>
      typeof e === 'object' &&
      e !== null &&
      (e as Record<string, unknown>)['occurrence'] === 'synthetic' &&
      (e as Record<string, unknown>)['isRadioactive'] === false,
  );
  if (syntheticNonRadioactive.length > 0)
    allErrors.push(`synthetic elements marked non-radioactive: ${syntheticNonRadioactive.length}`);

  if (allErrors.length > 0) return err(allErrors);
  return ok(raw as readonly Element[]);
}

export { BLOCKS, CATEGORIES };
export type { Block, ElementCategory, StandardState, Occurrence };
