import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SEEDS_DIR,
  RULE_CATEGORIES,
  LICENSE_WHITELIST,
  THERMO_VALUES,
  CONFIDENCE_VALUES,
  BUILD_VERSION,
  type RuleCategoryName,
} from './config.ts';

// 빌드 스크립트 자립 — @/ alias / 외부 라이브러리 비의존 (check-schema-version 패턴).
const SYMBOL_TO_NUM: Readonly<Record<string, number>> = {
  H: 1,
  B: 5,
  C: 6,
  N: 7,
  O: 8,
  F: 9,
  Na: 11,
  Mg: 12,
  Al: 13,
  Si: 14,
  P: 15,
  S: 16,
  Cl: 17,
  K: 19,
  Ca: 20,
  Br: 35,
  I: 53,
};

export interface BuiltRule {
  readonly id: string;
  readonly smarts: string;
  readonly conditionRange: {
    temperatureK?: [number, number];
    pressureAtm?: [number, number];
    pH?: [number, number];
  };
  readonly thermo: string;
  readonly source: string;
  readonly priority: number;
  readonly confidence: string;
  readonly categories: string[];
  readonly version: string;
  readonly license: string;
  readonly requiredElements: number[];
  readonly _category: RuleCategoryName;
  readonly _requiresPh: boolean;
  readonly _notesKo: string;
  readonly _notesEn: string;
}

const COLS = [
  'id',
  'smarts',
  'categories',
  'thermo',
  'priority',
  'confidence',
  'source',
  'license',
  'condition_t_min',
  'condition_t_max',
  'condition_p_min',
  'condition_p_max',
  'condition_ph_min',
  'condition_ph_max',
  'required_elements',
  'notes_ko',
  'notes_en',
] as const;

function parseTsv(path: string): Array<Record<string, string>> {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 1) return [];
  const headers = lines[0]!.split('\t').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}

function range(min: string, max: string): [number, number] | undefined {
  if (min === '' && max === '') return undefined;
  const lo = Number(min);
  const hi = Number(max);
  if (Number.isNaN(lo) || Number.isNaN(hi)) {
    throw new Error(`Invalid numeric range: "${min}".."${max}"`);
  }
  return [lo, hi];
}

export function validateSeeds(): { rules: BuiltRule[]; warnings: string[] } {
  const rules: BuiltRule[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (const category of RULE_CATEGORIES) {
    const rows = parseTsv(resolve(SEEDS_DIR, `${category}.tsv`));
    for (const row of rows) {
      for (const c of COLS) {
        if (!(c in row)) throw new Error(`[${category}] missing column "${c}"`);
      }
      const id = row.id!;
      if (!id) throw new Error(`[${category}] empty id`);
      if (seenIds.has(id)) throw new Error(`Duplicate rule id: ${id}`);
      seenIds.add(id);

      if (!row.source) throw new Error(`[${id}] source must not be empty`);
      if (!LICENSE_WHITELIST.includes(row.license as never)) {
        throw new Error(`[${id}] license "${row.license}" not in whitelist`);
      }
      if (!THERMO_VALUES.includes(row.thermo as never)) {
        throw new Error(`[${id}] invalid thermo "${row.thermo}"`);
      }
      if (!CONFIDENCE_VALUES.includes(row.confidence as never)) {
        throw new Error(`[${id}] invalid confidence "${row.confidence}"`);
      }
      const categories = row
        .categories!.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const c of categories) {
        if (!RULE_CATEGORIES.includes(c as never)) {
          throw new Error(`[${id}] unknown category "${c}"`);
        }
      }
      const priority = Number(row.priority);
      if (!Number.isInteger(priority)) throw new Error(`[${id}] priority not an int`);

      const requiredElements = (row.required_elements ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((sym) => {
          const n = SYMBOL_TO_NUM[sym];
          if (n === undefined) throw new Error(`[${id}] unknown element symbol "${sym}"`);
          return n;
        });

      const conditionRange: BuiltRule['conditionRange'] = {};
      const t = range(row.condition_t_min!, row.condition_t_max!);
      const p = range(row.condition_p_min!, row.condition_p_max!);
      const ph = range(row.condition_ph_min!, row.condition_ph_max!);
      if (t) conditionRange.temperatureK = t;
      if (p) conditionRange.pressureAtm = p;
      if (ph) conditionRange.pH = ph;

      // §8.9 #4 SMARTS RDKit 컴파일 검증 — DEFERRED (RDKit MinimalLib 반응 API 부재,
      // 규칙 엔진 deferred). 구문 sanity 만: '>>' 포함 여부 경고.
      if (!row.smarts!.includes('>>')) {
        warnings.push(`[${id}] SMARTS lacks '>>' (reaction arrow) — sanity warning only`);
      }

      rules.push({
        id,
        smarts: row.smarts!,
        conditionRange,
        thermo: row.thermo!,
        source: row.source!,
        priority,
        confidence: row.confidence!,
        categories,
        version: BUILD_VERSION,
        license: row.license!,
        requiredElements,
        _category: category,
        _requiresPh: ph !== undefined,
        _notesKo: row.notes_ko ?? '',
        _notesEn: row.notes_en ?? '',
      });
    }
  }
  return { rules, warnings };
}
