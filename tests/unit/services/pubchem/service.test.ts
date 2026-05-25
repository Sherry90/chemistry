import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { logger } from '@/utils/logger';
import { setupServer } from 'msw/node';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  getCompoundByCid,
  getCompoundByInchiKey,
  resolveCompoundByName,
} from '@/services/pubchem/index';
import { resetTokenBucket } from '@/services/pubchem/tokenBucket';
import { resetInflight } from '@/services/pubchem/inflightDedup';
import { resetDbSingleton } from '@/services/cache/db';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { ParsedMol } from '@/engine/rdkit/types';
import type { Molecule } from '@/chemistry/compounds/types';
import { createMoleculeId } from '@/chemistry/compounds/ids';
import { EMPTY_STEREO } from '@/types/stereo';
import {
  faultNotFound,
  nameToCidResponse,
} from '@/services/pubchem/__fixtures__/pubchem-responses/water';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

// Mock RDKit backend
const fakeParsedMol = {} as ParsedMol;
const fakeMolecule: Molecule = {
  id: createMoleculeId(),
  atoms: [],
  bonds: [],
  totalCharge: 0,
  canonicalSmiles: 'O',
  inchi: 'InChI=1S/H2O/h1H2',
  inchiKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
  stereo: EMPTY_STEREO,
  spinMultiplicity: 1,
};

const mockRdkitBackend: RdkitBackend = {
  parseSmiles: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
  parseInchi: vi.fn().mockResolvedValue({ ok: true, value: fakeParsedMol }),
  parseSdfBlock: vi.fn().mockResolvedValue({ ok: false, error: { message: 'no SDF' } }),
  embed: vi.fn().mockResolvedValue({ ok: true, value: fakeMolecule }),
  toCanonical: vi.fn().mockResolvedValue({
    smiles: 'O',
    inchi: 'InChI=1S/H2O/h1H2',
    inchiKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
  }),
};

// Override rdkit import for the service
vi.mock('@/engine/rdkit/index', () => ({
  ensureRdkit: vi.fn().mockResolvedValue(undefined),
  createMainThreadRdkitBackend: vi.fn().mockReturnValue(mockRdkitBackend),
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetTokenBucket();
  resetInflight();
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  resetDbSingleton();
  // Reset rdkit backend singleton so it's re-created each test
  vi.resetModules();
});
afterAll(() => server.close());

describe('D10: manifest hit prevents PubChem call', () => {
  it('CID 962 (water) is in manifest → MSW handler NOT called', async () => {
    let handlerCalled = 0;
    server.use(
      http.get(`${BASE}/compound/cid/962/*`, () => {
        handlerCalled++;
        return HttpResponse.json({});
      }),
    );

    const result = await getCompoundByCid(962);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cid).toBe(962);
    }
    expect(handlerCalled).toBe(0);
  });
});

describe('In-flight dedup', () => {
  it('two concurrent calls for same CID result in single fetch', async () => {
    // CID 99999 is NOT in manifest
    let fetchCount = 0;
    server.use(
      http.get(`${BASE}/compound/cid/99999/property/*`, () => {
        fetchCount++;
        return HttpResponse.json({
          PropertyTable: {
            Properties: [
              {
                CID: 99999,
                MolecularFormula: 'CH4',
                MolecularWeight: '16.04',
                CanonicalSMILES: 'C',
                IsomericSMILES: 'C',
                IUPACName: 'methane',
              },
            ],
          },
        });
      }),
      http.get(`${BASE}/compound/cid/99999/SDF`, () => new HttpResponse(null, { status: 404 })),
    );

    const [r1, r2] = await Promise.all([getCompoundByCid(99999), getCompoundByCid(99999)]);

    expect(fetchCount).toBe(1); // single fetch shared
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

describe('NotFound normalization', () => {
  it('HTTP 404 → kind: NotFound', async () => {
    server.use(
      http.get(
        `${BASE}/compound/cid/99998/property/*`,
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(`${BASE}/compound/cid/99998/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await getCompoundByCid(99998);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('NotFound');
    }
  });

  it('200 + Fault.Code PUGREST.NotFound → kind: NotFound', async () => {
    server.use(
      http.get(`${BASE}/compound/cid/99997/property/*`, () => HttpResponse.json(faultNotFound)),
      http.get(`${BASE}/compound/cid/99997/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await getCompoundByCid(99997);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('NotFound');
    }
  });
});

describe('Schema validation failure', () => {
  it('malformed response → kind: Schema', async () => {
    server.use(
      http.get(`${BASE}/compound/cid/99996/property/*`, () =>
        HttpResponse.json({ unexpected: 'shape' }),
      ),
      http.get(`${BASE}/compound/cid/99996/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await getCompoundByCid(99996);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Schema');
      if (result.error.kind === 'Schema') {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveCompoundByName', () => {
  it('manifest hit (water) resolves without network', async () => {
    let handlerCalled = 0;
    server.use(
      http.get(`${BASE}/compound/name/*`, () => {
        handlerCalled++;
        return HttpResponse.json(nameToCidResponse);
      }),
    );
    const result = await resolveCompoundByName('water');
    expect(result.ok).toBe(true);
    expect(handlerCalled).toBe(0);
  });

  it('name miss → PubChem name→CID → getCompoundByCid', async () => {
    server.use(
      http.get(`${BASE}/compound/name/*`, () =>
        HttpResponse.json({ IdentifierList: { CID: [99995] } }),
      ),
      http.get(`${BASE}/compound/cid/99995/property/*`, () =>
        HttpResponse.json({
          PropertyTable: {
            Properties: [
              {
                CID: 99995,
                MolecularFormula: 'C6H6',
                MolecularWeight: '78.11',
                CanonicalSMILES: 'c1ccccc1',
                IsomericSMILES: 'c1ccccc1',
                IUPACName: 'benzene',
              },
            ],
          },
        }),
      ),
      http.get(`${BASE}/compound/cid/99995/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    // Phase 15 hotfix — query 가 확장 manifest entry (benzene CID 241) 와 충돌하지
    // 않도록 unique stub name 사용 — manifest miss → PubChem name→CID 경로 검증 목적.
    const result = await resolveCompoundByName('rare-pubchem-only-name-xyz');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cid).toBe(99995);
    }
  });

  it('multiple CIDs → first adopted + logger.warn (§8.3#9)', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    server.use(
      // true network path: name not in manifest, returns 3 CIDs
      http.get(`${BASE}/compound/name/*`, () =>
        HttpResponse.json({ IdentifierList: { CID: [99991, 99992, 99993] } }),
      ),
      http.get(`${BASE}/compound/cid/99991/property/*`, () =>
        HttpResponse.json({
          PropertyTable: {
            Properties: [
              {
                CID: 99991,
                MolecularFormula: 'C6H6',
                MolecularWeight: '78.11',
                CanonicalSMILES: 'c1ccccc1',
                IsomericSMILES: 'c1ccccc1',
                IUPACName: 'benzene',
              },
            ],
          },
        }),
      ),
      http.get(`${BASE}/compound/cid/99991/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await resolveCompoundByName('multi-cid-name-xyz');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cid).toBe(99991); // first CID adopted
    }
    expect(warnSpy).toHaveBeenCalledWith(
      'pubchem: multiple CIDs for name query, using first',
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('SDF 404 at service layer → coordinateSource rdkit-etkdg (§8.3#12)', async () => {
    server.use(
      http.get(`${BASE}/compound/name/*`, () =>
        HttpResponse.json({ IdentifierList: { CID: [99994] } }),
      ),
      http.get(`${BASE}/compound/cid/99994/property/*`, () =>
        HttpResponse.json({
          PropertyTable: {
            Properties: [
              {
                CID: 99994,
                MolecularFormula: 'C6H6',
                MolecularWeight: '78.11',
                CanonicalSMILES: 'c1ccccc1',
                IsomericSMILES: 'c1ccccc1',
                IUPACName: 'benzene',
              },
            ],
          },
        }),
      ),
      http.get(`${BASE}/compound/cid/99994/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await resolveCompoundByName('sdf-404-name-xyz');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.coordinateSource).toBe('rdkit-etkdg');
    }
  });

  it('NotFound when name resolves to no CIDs', async () => {
    server.use(http.get(`${BASE}/compound/name/*`, () => HttpResponse.json(faultNotFound)));
    const result = await resolveCompoundByName('xyzzy-nonexistent-compound');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('NotFound');
    }
  });
});

describe('getCompoundByInchiKey', () => {
  it('invalid format → NotFound immediately', async () => {
    const result = await getCompoundByInchiKey('INVALID');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('NotFound');
    }
  });

  it('manifest hit → no network', async () => {
    let handlerCalled = 0;
    server.use(
      http.get(`${BASE}/compound/inchikey/*`, () => {
        handlerCalled++;
        return HttpResponse.json({});
      }),
    );
    // Water's InChIKey is in manifest
    const result = await getCompoundByInchiKey('XLYOFNOQVPJJNP-UHFFFAOYSA-N');
    expect(result.ok).toBe(true);
    expect(handlerCalled).toBe(0);
  });
});

describe('AbortSignal propagation', () => {
  it('returns Aborted when signal fires before fetch', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await getCompoundByCid(99990, { signal: ctrl.signal });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Aborted');
    }
  });

  it('abort during RDKit stage → Aborted, cache write skipped (§8.3#6)', async () => {
    let propCount = 0;
    server.use(
      http.get(`${BASE}/compound/cid/99996/property/*`, () => {
        propCount++;
        return HttpResponse.json({
          PropertyTable: {
            Properties: [
              {
                CID: 99996,
                MolecularFormula: 'C6H6',
                MolecularWeight: '78.11',
                CanonicalSMILES: 'c1ccccc1',
                IsomericSMILES: 'c1ccccc1',
                IUPACName: 'benzene',
              },
            ],
          },
        });
      }),
      http.get(`${BASE}/compound/cid/99996/SDF`, () => new HttpResponse(null, { status: 404 })),
    );
    // RDKit embed takes ~50ms; abort fires at ~10ms (during the RDKit stage).
    vi.mocked(mockRdkitBackend.embed).mockImplementationOnce(async () => {
      await delay(50);
      return { ok: true, value: fakeMolecule };
    });
    const ctrl = new AbortController();
    const p = getCompoundByCid(99996, { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 10);
    const result = await p;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Aborted');
    }
    // cache write skipped → a subsequent lookup must hit the network again.
    const again = await getCompoundByCid(99996);
    expect(again.ok).toBe(true);
    expect(propCount).toBe(2); // first (aborted) + second (fresh) → not served from cache
  });
});
