/**
 * Phase 05 §8.4 — 통합: 전체 런타임 데이터 레이어 플로우.
 * (Vitest + jsdom + fake-indexeddb + MSW)
 *
 * 3 케이스:
 *  (a) 매니페스트 miss → 캐시 miss → 네트워크(handler=1) → 재호출 캐시 hit(handler=0)
 *  (b) 세션 재시작 시뮬레이션 — 캐시 영속, 모듈 싱글톤 reset 후 같은 CID → 네트워크 0
 *  (c) schemaVersion bump 시뮬레이션 — 캐시에 v=1 레코드 저장(현 상수=2 → stale) →
 *      같은 CID 요청 시 stale 판정으로 재-fetch(network=1)
 *
 * MSW/fake-indexeddb 설정은 tests/unit/services/pubchem/service.test.ts /
 * tests/unit/services/cache/compoundStore.test.ts 의 컨벤션을 그대로 따른다.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { getCompoundByCid } from '@/services/pubchem/index';
import { resetTokenBucket } from '@/services/pubchem/tokenBucket';
import { resetInflight } from '@/services/pubchem/inflightDedup';
import { openAppDb, resetDbSingleton } from '@/services/cache/db';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { ParsedMol } from '@/engine/rdkit/types';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

// 매니페스트에 없는 임의 고정 CID (현 시드는 5개 무기물; 99001 은 미존재).
const OFF_MANIFEST_CID = 99001;

const fakeParsedMol = {} as ParsedMol;
const fakeMolecule = {
  id: 'test',
  atoms: [],
  bonds: [],
  totalCharge: 0,
  canonicalSmiles: 'C',
  inchi: 'InChI=1S/CH4/h1H4',
  inchiKey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
  stereo: { atomStereo: [], bondStereo: [] },
  spinMultiplicity: 1,
};

const mockRdkitBackend: RdkitBackend = {
  parseSmiles: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
  parseInchi: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
  parseSdfBlock: vi.fn().mockResolvedValue({ ok: false, error: { message: 'no SDF' } }),
  embed: vi.fn().mockResolvedValue({ ok: true, value: fakeMolecule }),
  toCanonical: vi.fn().mockResolvedValue({
    smiles: 'C',
    inchi: 'InChI=1S/CH4/h1H4',
    inchiKey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
  }),
};

vi.mock('@/engine/rdkit/index', () => ({
  ensureRdkit: vi.fn().mockResolvedValue(undefined),
  createMainThreadRdkitBackend: vi.fn().mockReturnValue(mockRdkitBackend),
}));

const server = setupServer();

function propertyHandler(cid: number, onHit: () => void) {
  return http.get(`${BASE}/compound/cid/${cid}/property/*`, () => {
    onHit();
    return HttpResponse.json({
      PropertyTable: {
        Properties: [
          {
            CID: cid,
            MolecularFormula: 'CH4',
            MolecularWeight: '16.04',
            CanonicalSMILES: 'C',
            IsomericSMILES: 'C',
            IUPACName: 'methane',
          },
        ],
      },
    });
  });
}

function sdf404(cid: number) {
  return http.get(`${BASE}/compound/cid/${cid}/SDF`, () => new HttpResponse(null, { status: 404 }));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetTokenBucket();
  resetInflight();
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  resetDbSingleton();
  vi.resetModules();
});
afterAll(() => server.close());

describe('§8.4 (a) manifest miss → cache miss → network → cache hit', () => {
  it('first call fetches network (handler=1), second call cache hit (handler=0)', async () => {
    let handlerCalled = 0;
    server.use(
      propertyHandler(OFF_MANIFEST_CID, () => handlerCalled++),
      sdf404(OFF_MANIFEST_CID),
    );

    const first = await getCompoundByCid(OFF_MANIFEST_CID);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.cid).toBe(OFF_MANIFEST_CID);
    expect(handlerCalled).toBe(1);

    // cache.put 발생 검증 — 직접 IDB 조회.
    const db = await openAppDb();
    const stored = await db.get('compounds', OFF_MANIFEST_CID);
    expect(stored).toBeDefined();
    expect(stored?.value.cid).toBe(OFF_MANIFEST_CID);

    // 두 번째 호출: 캐시 hit → 네트워크 0.
    resetInflight();
    const second = await getCompoundByCid(OFF_MANIFEST_CID);
    expect(second.ok).toBe(true);
    expect(handlerCalled).toBe(1); // 추가 호출 없음
  });
});

describe('§8.4 (b) session-restart simulation', () => {
  it('persisted cache survives module singleton reset → 0 network on second session', async () => {
    let handlerCalled = 0;
    server.use(
      propertyHandler(OFF_MANIFEST_CID, () => handlerCalled++),
      sdf404(OFF_MANIFEST_CID),
    );

    // 세션 1: 네트워크 fetch → 캐시 저장.
    const s1 = await getCompoundByCid(OFF_MANIFEST_CID);
    expect(s1.ok).toBe(true);
    expect(handlerCalled).toBe(1);

    // 세션 재시작 시뮬레이션 — IDB 인스턴스는 유지(영속), 메모리 싱글톤만 reset.
    resetInflight();
    resetTokenBucket();
    resetDbSingleton();

    // 세션 2: 같은 CID → 영속 캐시 hit → 네트워크 0.
    const s2 = await getCompoundByCid(OFF_MANIFEST_CID);
    expect(s2.ok).toBe(true);
    if (s2.ok) expect(s2.value.cid).toBe(OFF_MANIFEST_CID);
    expect(handlerCalled).toBe(1); // 세션 2 에서 추가 네트워크 없음
  });
});

describe('§8.4 (c) schemaVersion bump simulation', () => {
  it('a v=1 cache record is stale under current schema → re-fetch (network=1)', async () => {
    let handlerCalled = 0;
    server.use(
      propertyHandler(OFF_MANIFEST_CID, () => handlerCalled++),
      sdf404(OFF_MANIFEST_CID),
    );

    // 구 스키마(v=1) 레코드를 IDB 에 직접 삽입. 현 NORMALIZE_SCHEMA_VERSION=2 →
    // compoundStore.get 의 stale 판정으로 null 반환 → 상위 로직이 네트워크 진입.
    const db = await openAppDb();
    await db.put('compounds', {
      value: {
        cid: OFF_MANIFEST_CID,
        provenance: 'runtime-fetch',
        name: { ko: null, en: 'stale methane' },
        molecularFormula: 'CH4',
        molecularWeight: 16.04,
        smiles: 'C',
        inchi: 'InChI=1S/CH4/h1H4',
        inchiKey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
        iupacName: 'methane',
        synonyms: [],
        category: 'inorganic-common',
        priority: 9999,
        properties: {
          meltingPointK: null,
          boilingPointK: null,
          densityGPerCm3: null,
          standardState: 'unknown',
          waterSolubility: 'unknown',
          logP: null,
        },
        coordinateSource: 'rdkit-etkdg',
        defaultMolecule: null,
      },
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
      schemaVersion: 1, // 구 버전 — 현재 상수(2)와 불일치 → stale
    } as never);

    const result = await getCompoundByCid(OFF_MANIFEST_CID);
    expect(result.ok).toBe(true);
    // stale 레코드는 무시되고 네트워크 재호출 발생.
    expect(handlerCalled).toBe(1);
    if (result.ok) {
      // 재-fetch 한 fresh compound (placeholder 이름이 아님).
      expect(result.value.name.en).toBe('methane');
    }
  });
});
