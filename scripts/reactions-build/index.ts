/**
 * Phase 06 — Reaction 규칙 데이터 빌드.
 * seeds/*.tsv → 검증 → 결정적 청크 + 매니페스트 → src/data/reactions/.
 *
 * Usage: pnpm run build:reactions
 *
 * ⚠️ SMARTS RDKit 컴파일 검증(§8.9 #4)은 규칙 엔진 deferred 와 함께 보류
 *    (RDKit MinimalLib 반응 API 부재). 구조/라이선스/스키마 검증은 수행.
 *
 * 자립 스크립트 — @/ alias / 외부 라이브러리 비의존
 * (node --experimental-strip-types 단독 실행).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUT_DIR, CHUNKS_DIR } from './config.ts';
import { validateSeeds } from './validate.ts';
import { buildChunks } from './chunk.ts';
import { buildManifest } from './manifest.ts';
import { printReport } from './report.ts';

function main(): void {
  const { rules, warnings } = validateSeeds();

  mkdirSync(CHUNKS_DIR, { recursive: true });

  const chunks = buildChunks(rules);
  for (const [cat, chunk] of chunks) {
    writeFileSync(resolve(CHUNKS_DIR, `${cat}.json`), JSON.stringify(chunk, null, 2) + '\n');
  }

  const manifest = buildManifest(rules);
  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  printReport(rules, warnings);
  process.stdout.write('reactions-build: OK\n');
}

try {
  main();
} catch (e) {
  process.stderr.write(`reactions-build: FAIL — ${(e as Error).message}\n`);
  process.exit(1);
}
