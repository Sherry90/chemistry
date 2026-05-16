/**
 * CI guard (Phase 05 DoD #13 / Phase 04 §10 #13 의 짝).
 *
 * `src/data/compounds/compounds.meta.json` 의 `normalizeSchemaVersion` 값이
 * `src/engine/pubchem/normalize.ts` 의 `NORMALIZE_SCHEMA_VERSION` 상수와
 * 정확히 일치하는지 정적으로 검증한다. 한쪽만 bump 되면 exit code 1 로 CI 실패.
 *
 * 정적 소스 파싱(정규식) 으로 구현하여 `@/` alias / 외부 라이브러리 의존 없이
 * `node --experimental-strip-types scripts/check-schema-version.ts` 단독 실행 가능.
 *
 * Usage: pnpm run check:schema-version
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const NORMALIZE_PATH = resolve(repoRoot, 'src/engine/pubchem/normalize.ts');
const META_PATH = resolve(repoRoot, 'src/data/compounds/compounds.meta.json');

function fail(message: string): never {
  process.stderr.write(`check-schema-version: FAIL — ${message}\n`);
  process.exit(1);
}

// 1. engine 상수 추출 (정적 정규식 — import 해석 불필요).
const normalizeSrc = readFileSync(NORMALIZE_PATH, 'utf8');
const constMatch = normalizeSrc.match(
  /export\s+const\s+NORMALIZE_SCHEMA_VERSION\s*=\s*(\d+)\s*as\s+const/,
);
if (!constMatch) {
  fail(
    `Could not locate "export const NORMALIZE_SCHEMA_VERSION = <n> as const" in ${NORMALIZE_PATH}`,
  );
}
const engineVersion = Number.parseInt(constMatch[1]!, 10);

// 2. 매니페스트 메타 값 추출.
let meta: { normalizeSchemaVersion?: unknown };
try {
  meta = JSON.parse(readFileSync(META_PATH, 'utf8')) as { normalizeSchemaVersion?: unknown };
} catch (e) {
  fail(`Could not read/parse ${META_PATH}: ${(e as Error).message}`);
}
const metaVersion = meta.normalizeSchemaVersion;
if (typeof metaVersion !== 'number' || !Number.isInteger(metaVersion)) {
  fail(`compounds.meta.json.normalizeSchemaVersion is not an integer: ${String(metaVersion)}`);
}

// 3. 일치 검증.
if (engineVersion !== metaVersion) {
  fail(
    `Schema version mismatch — NORMALIZE_SCHEMA_VERSION (${engineVersion}) ` +
      `!== compounds.meta.json.normalizeSchemaVersion (${metaVersion}). ` +
      `When normalize signature/mapping changes, bump BOTH the constant and re-run the ` +
      `compound pipeline so the manifest meta stays in sync.`,
  );
}

process.stdout.write(
  `check-schema-version: OK — NORMALIZE_SCHEMA_VERSION === ` +
    `compounds.meta.json.normalizeSchemaVersion === ${engineVersion}\n`,
);
process.exit(0);
