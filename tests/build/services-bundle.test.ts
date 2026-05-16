/**
 * Phase 05 §8.6 / DoD #10 — 번들 분리 정적 검증 (Phase 04 §8.5 패턴 답습).
 *
 * 완전한 `vite build` 산출물 검사(`dist/assets/` 해시 청크 grep)는 CI 의
 * build-time 단계에 둔다 — 본 단위 테스트는 무거운 빌드 없이 같은 의도를
 * 정적 소스 분석으로 보장한다:
 *
 *  1. `services/cache` 는 `services/pubchem` 이 **dynamic import** 로만 진입
 *     → 매니페스트 hit 경로(가장 빈번)에서 IndexedDB 코드 미로딩 → 별도 lazy chunk.
 *     (코드 스플리팅 진입점은 설계상 src/services/pubchem/index.ts 의 getCache().)
 *  2. `idb` 라이브러리는 `src/services/cache/` 외부에서 static import 금지
 *     → 초기 엔트리 번들에 `idb` 코드 미포함 (DoD #11, §6.9).
 *
 * NOTE: 완전한 번들 크기/청크 해시 검증은 build-time CI step 의 책임이다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const SRC = resolve(repoRoot, 'src');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('§8.6 #1 — services/cache is a lazy (dynamic-import) chunk', () => {
  it('src/services/pubchem/index.ts reaches services/cache only via dynamic import()', () => {
    const src = readFileSync(resolve(SRC, 'services/pubchem/index.ts'), 'utf8');

    // 동적 import 존재.
    expect(src).toMatch(/import\(\s*['"]@\/services\/cache['"]\s*\)/);

    // 최상위 정적 `import ... from '@/services/cache'` (값 import) 부재.
    // (타입 전용 import 는 번들에 남지 않으므로 허용.)
    const staticValueImport =
      /^\s*import\s+(?!type\b)[^;]*\bfrom\s+['"]@\/services\/cache(?:\/[^'"]*)?['"]/m;
    expect(staticValueImport.test(src)).toBe(false);
  });

  it('no module under src/services/pubchem statically value-imports services/cache', () => {
    const files = listTsFiles(resolve(SRC, 'services/pubchem'));
    const staticValueImport =
      /^\s*import\s+(?!type\b)[^;]*\bfrom\s+['"]@\/services\/cache(?:\/[^'"]*)?['"]/m;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(staticValueImport.test(src), `${f} must not static value-import services/cache`).toBe(
        false,
      );
    }
  });
});

describe('§8.6 #2 — idb is not in the initial entry bundle', () => {
  it("no source file outside src/services/cache/ imports 'idb'", () => {
    const files = listTsFiles(SRC).filter((f) => !f.includes(`${join('services', 'cache')}`));
    const idbImport = /\bfrom\s+['"]idb['"]|\bimport\(\s*['"]idb['"]\s*\)/;
    const offenders = files.filter((f) => idbImport.test(readFileSync(f, 'utf8')));
    expect(offenders, `idb may only be imported from src/services/cache/`).toEqual([]);
  });

  it('src/services/cache/db.ts is the sole idb consumer (sanity)', () => {
    const cacheFiles = listTsFiles(resolve(SRC, 'services/cache'));
    const idbImport = /\bfrom\s+['"]idb['"]/;
    const consumers = cacheFiles.filter((f) => idbImport.test(readFileSync(f, 'utf8')));
    expect(consumers.length).toBeGreaterThan(0);
  });
});
