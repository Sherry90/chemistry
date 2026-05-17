import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SEEDS_DIR = resolve(__dirname, 'seeds');
export const OUT_DIR = resolve(__dirname, '../../src/data/reactions');
export const CHUNKS_DIR = resolve(OUT_DIR, 'chunks');

export const RULE_CATEGORIES = [
  'acid-base-neutralization',
  'esterification-hydrolysis',
  'simple-redox',
] as const;
export type RuleCategoryName = (typeof RULE_CATEGORIES)[number];

export const LICENSE_WHITELIST = [
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'MIT',
  'CC-BY-4.0',
  'CC0-1.0',
  'in-house',
] as const;

export const THERMO_VALUES = ['exothermic', 'endothermic', 'unknown'] as const;
export const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;

// 결정적 빌드 — 모든 청크/매니페스트가 동일 version 을 공유.
export const BUILD_VERSION = '2026-05-17T00:00:00.000Z';

// 표기 의무 라이선스 → attribution URL.
export const ATTRIBUTION_URL: Readonly<Record<string, string | null>> = {
  'BSD-3-Clause': 'https://github.com/rdkit/rdkit',
};
