/**
 * Phase 06 §8.9 — reactions-build 데이터 무결성 + 결정성.
 * 스크립트는 `node --experimental-strip-types` 로 자립 실행 (.ts 확장 import).
 * vite 로 .ts 확장 import 해석 마찰을 피하려고 자식 프로세스로 구동 후 산출물 검증.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = resolve(repoRoot, 'scripts/reactions-build/index.ts');
const MANIFEST = resolve(repoRoot, 'src/data/reactions/manifest.json');
const CHUNKS = ['acid-base-neutralization', 'esterification-hydrolysis', 'simple-redox'].map((c) =>
  resolve(repoRoot, `src/data/reactions/chunks/${c}.json`),
);

function runBuild(): string {
  return execFileSync('node', ['--experimental-strip-types', SCRIPT], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('reactions-build', () => {
  it('runs OK and reports deferred SMARTS check', () => {
    const out = runBuild();
    expect(out).toContain('reactions-build: OK');
    expect(out).toContain('DEFERRED');
  });

  it('is deterministic — committed artifacts equal a fresh build', () => {
    const before = [MANIFEST, ...CHUNKS].map((p) => readFileSync(p, 'utf8'));
    runBuild();
    const after = [MANIFEST, ...CHUNKS].map((p) => readFileSync(p, 'utf8'));
    expect(after).toEqual(before);
  });

  it('manifest is well-formed', () => {
    runBuild();
    const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
      totalRules: number;
      entries: unknown[];
      licenseSummary: { license: string; count: number }[];
    };
    expect(m.totalRules).toBe(3);
    expect(m.entries).toHaveLength(3);
    const sum = m.licenseSummary.reduce((s, l) => s + l.count, 0);
    expect(sum).toBe(3);
  });
});
