/**
 * Phase 05 DoD #13 — schemaVersion 동기 가드.
 *
 * normalize-snapshot.test.ts 의 스냅샷이 갱신된 PR 에서 `NORMALIZE_SCHEMA_VERSION`
 * 상수가 같이 bump 되지 않으면 이 테스트가 실패하도록, 세 곳의 버전 정보가
 * 모두 일치하는지 검증한다:
 *   - engine 상수: src/engine/pubchem/normalize.ts
 *   - cache 상수:  src/services/cache/schema.ts
 *   - 빌드 산출물:  src/data/compounds/compounds.meta.json (.normalizeSchemaVersion)
 */
import { describe, it, expect } from 'vitest';
import { NORMALIZE_SCHEMA_VERSION as ENGINE_VERSION } from '@/engine/pubchem/normalize';
import { NORMALIZE_SCHEMA_VERSION as CACHE_VERSION } from '@/services/cache/schema';
import compoundsMeta from '@/data/compounds/compounds.meta.json';

describe('schemaVersion guard (DoD #13)', () => {
  it('engine NORMALIZE_SCHEMA_VERSION === cache NORMALIZE_SCHEMA_VERSION', () => {
    expect(ENGINE_VERSION).toBe(CACHE_VERSION);
  });

  it('compounds.meta.json.normalizeSchemaVersion === engine NORMALIZE_SCHEMA_VERSION', () => {
    expect(compoundsMeta.normalizeSchemaVersion).toBe(ENGINE_VERSION);
  });

  it('all three schema-version sources agree', () => {
    expect(
      new Set([ENGINE_VERSION, CACHE_VERSION, compoundsMeta.normalizeSchemaVersion]).size,
    ).toBe(1);
  });
});
