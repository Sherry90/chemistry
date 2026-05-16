import type { LookupOptions, LookupResult } from './types';
import type { RdkitBackend } from '@/engine/rdkit/backend';
import type { PubChemPropertyRow } from '@/engine/pubchem/normalize';
import type { Compound } from '@/chemistry/compounds/types';
import { getInflight, setInflight } from './inflightDedup';
import { pubchemFetch } from './client';
import { cidPropertiesUrl, cid3dSdfUrl, nameToCidUrl, inchiKeyToCidUrl } from './endpoints';
import { PropertyTableResponseSchema, FaultResponseSchema, IdentifierListSchema } from './schemas';
import { normalizePubChemResponse } from '@/engine/pubchem/normalize';
import {
  findCompoundByCid,
  findCompoundByInchiKey,
  searchCompoundManifest,
} from '@/data/compounds/index';
import { setRdkitLoading, incrementInflight, decrementInflight } from './readiness';
import { logger } from '@/utils/logger';

export type { PubChemError } from './errors';
export { subscribeReadiness, getReadinessSnapshot } from './readiness';

interface CacheApi {
  readonly compoundCache: {
    get(cid: number): Promise<Compound | null>;
    getByInchiKey(key: string): Promise<Compound | null>;
    put(compound: Compound): Promise<void>;
  };
}
let cacheModule: CacheApi | null = null;

async function getCache(): Promise<CacheApi> {
  if (!cacheModule) {
    cacheModule = (await import('@/services/cache')) as CacheApi;
  }
  return cacheModule;
}

let rdkitBackend: RdkitBackend | null = null;

async function getRdkitBackend(): Promise<RdkitBackend> {
  if (rdkitBackend) return rdkitBackend;
  setRdkitLoading(true);
  try {
    const { ensureRdkit, createMainThreadRdkitBackend } = await import('@/engine/rdkit/index');
    await ensureRdkit();
    rdkitBackend = createMainThreadRdkitBackend();
    return rdkitBackend;
  } finally {
    setRdkitLoading(false);
  }
}

async function fetchAndNormalizeCid(cid: number, opts?: LookupOptions): Promise<LookupResult> {
  const signal = opts?.signal;

  incrementInflight();
  try {
    logger.debug('pubchem: fetching CID', { cid });

    // Parallel fetch: property + 3D SDF
    const [propRes, sdfRes] = await Promise.all([
      pubchemFetch(cidPropertiesUrl(cid), signal),
      pubchemFetch(cid3dSdfUrl(cid), signal),
    ]);

    if (!propRes.ok) {
      // §8.3#10: property 엔드포인트 HTTP 404 = 화합물 없음 → NotFound 로 정규화
      // (200+Fault.Code 경로와 동일 분류). 그 외 상태/네트워크/타임아웃은 그대로 전파.
      if (propRes.error.kind === 'HttpStatus' && propRes.error.status === 404) {
        return {
          ok: false,
          error: { kind: 'NotFound', query: { type: 'cid', value: cid }, retryable: false },
        };
      }
      return propRes;
    }

    let propJson: unknown;
    try {
      propJson = await propRes.value.json();
    } catch {
      return {
        ok: false,
        error: { kind: 'Network', cause: 'Failed to parse JSON', retryable: true },
      };
    }

    // Check for Fault in property response
    const faultCheck = FaultResponseSchema.safeParse(propJson);
    if (faultCheck.success) {
      const code = faultCheck.data.Fault.Code;
      if (code === 'PUGREST.NotFound' || code.includes('NotFound')) {
        return {
          ok: false,
          error: { kind: 'NotFound', query: { type: 'cid', value: cid }, retryable: false },
        };
      }
    }

    const propParsed = PropertyTableResponseSchema.safeParse(propJson);
    if (!propParsed.success) {
      return {
        ok: false,
        error: { kind: 'Schema', issues: propParsed.error.issues, retryable: false },
      };
    }

    const row = propParsed.data.PropertyTable.Properties[0];
    if (!row) {
      return {
        ok: false,
        error: { kind: 'NotFound', query: { type: 'cid', value: cid }, retryable: false },
      };
    }

    // 3D SDF (404 is ok — fall back to RDKit embed)
    let sdf: string | null = null;
    if (sdfRes.ok) {
      try {
        sdf = await sdfRes.value.text();
      } catch {
        sdf = null;
      }
    }

    if (signal?.aborted) {
      return { ok: false, error: { kind: 'Aborted', retryable: false } };
    }

    const rdkit = await getRdkitBackend();

    if (signal?.aborted) {
      return { ok: false, error: { kind: 'Aborted', retryable: false } };
    }

    const normalizeResult = await normalizePubChemResponse(row as PubChemPropertyRow, sdf, {
      rdkit,
      fillRuntimeDefaults: true,
    });

    if (!normalizeResult.ok) {
      const e = normalizeResult.error;
      const reason =
        e.kind === 'MissingRequiredField' ? `${e.kind}: ${e.field}` : `${e.kind}: ${e.detail}`;
      return { ok: false, error: { kind: 'RdkitFailed', reason, retryable: false } };
    }

    if (signal?.aborted) {
      return { ok: false, error: { kind: 'Aborted', retryable: false } };
    }

    const compound = normalizeResult.value;
    const cache = await getCache();
    await cache.compoundCache.put(compound);

    logger.info('pubchem: fetched CID successfully', { cid });
    return { ok: true, value: compound };
  } finally {
    decrementInflight();
  }
}

export async function getCompoundByCid(cid: number, opts?: LookupOptions): Promise<LookupResult> {
  // D10: manifest hit → no network call
  const manifestHit = await findCompoundByCid(cid);
  if (manifestHit) {
    logger.debug('pubchem: manifest hit', { cid });
    return { ok: true, value: manifestHit };
  }

  // In-flight dedup. The promise must be registered synchronously (no await
  // between the getInflight check and setInflight) so that a second concurrent
  // caller observes the in-flight entry instead of starting its own fetch.
  const existing = getInflight(cid);
  if (existing) {
    logger.debug('pubchem: in-flight dedup hit', { cid });
    return existing;
  }

  const promise = (async (): Promise<LookupResult> => {
    // Cache lookup
    const cache = await getCache();
    const cached = await cache.compoundCache.get(cid);
    if (cached) {
      logger.debug('pubchem: cache hit', { cid });
      return { ok: true, value: cached };
    }

    // Network fetch
    return fetchAndNormalizeCid(cid, opts);
  })();
  setInflight(cid, promise);
  return promise;
}

export async function getCompoundByInchiKey(
  inchiKey: string,
  opts?: LookupOptions,
): Promise<LookupResult> {
  // Validate InChIKey format (27 chars: 14-10-1 segments separated by dashes)
  if (!/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchiKey)) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'inchiKey', value: inchiKey }, retryable: false },
    };
  }

  // D10: manifest hit
  const manifestHit = await findCompoundByInchiKey(inchiKey);
  if (manifestHit) {
    return { ok: true, value: manifestHit };
  }

  // Cache lookup by InChIKey
  const cache = await getCache();
  const cached = await cache.compoundCache.getByInchiKey(inchiKey);
  if (cached) {
    return { ok: true, value: cached };
  }

  // Resolve InChIKey → CID → fetch
  const res = await pubchemFetch(inchiKeyToCidUrl(inchiKey), opts?.signal);
  if (!res.ok) return res;

  let json: unknown;
  try {
    json = await res.value.json();
  } catch {
    return { ok: false, error: { kind: 'Network', cause: 'JSON parse error', retryable: true } };
  }

  const faultCheck = FaultResponseSchema.safeParse(json);
  if (faultCheck.success) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'inchiKey', value: inchiKey }, retryable: false },
    };
  }

  const parsed = IdentifierListSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'inchiKey', value: inchiKey }, retryable: false },
    };
  }

  const cid = parsed.data.IdentifierList.CID[0];
  if (cid === undefined) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'inchiKey', value: inchiKey }, retryable: false },
    };
  }

  return getCompoundByCid(cid, opts);
}

export async function resolveCompoundByName(
  name: string,
  opts?: LookupOptions,
): Promise<LookupResult> {
  const query = name.trim().normalize('NFC');
  if (!query) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'name', value: name }, retryable: false },
    };
  }

  // Manifest search — returns results sorted by score desc
  const results = searchCompoundManifest({ query, limit: 1 });
  if (results.length > 0) {
    const cid = results[0]!.cid;
    return getCompoundByCid(cid, opts);
  }

  // PubChem name → CID
  const res = await pubchemFetch(nameToCidUrl(query), opts?.signal);
  if (!res.ok) {
    if (res.error.kind === 'HttpStatus' && res.error.status === 404) {
      return {
        ok: false,
        error: { kind: 'NotFound', query: { type: 'name', value: query }, retryable: false },
      };
    }
    return res;
  }

  let json: unknown;
  try {
    json = await res.value.json();
  } catch {
    return { ok: false, error: { kind: 'Network', cause: 'JSON parse error', retryable: true } };
  }

  const faultCheck = FaultResponseSchema.safeParse(json);
  if (faultCheck.success) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'name', value: query }, retryable: false },
    };
  }

  const parsed = IdentifierListSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { kind: 'Schema', issues: parsed.error.issues, retryable: false } };
  }

  const cids = parsed.data.IdentifierList.CID;
  if (cids.length > 1) {
    logger.warn('pubchem: multiple CIDs for name query, using first', {
      name: query,
      count: cids.length,
    });
  }

  const cid = cids[0];
  if (cid === undefined) {
    return {
      ok: false,
      error: { kind: 'NotFound', query: { type: 'name', value: query }, retryable: false },
    };
  }

  return getCompoundByCid(cid, opts);
}
