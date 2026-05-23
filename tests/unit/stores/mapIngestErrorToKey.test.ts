// Phase 15 hotfix B — mapIngestErrorToKey + pubchemErrorToMapping 검증.
// PubChemError 8 kind → 지역화 키 + retryable→action 매핑.
import { describe, it, expect } from 'vitest';
import { mapIngestErrorToKey } from '@/stores';
import type { IngestError } from '@/stores/_shared/types';

const wrap = (detail: object): IngestError =>
  ({ kind: 'pubchem', detail }) as unknown as IngestError;

describe('mapIngestErrorToKey — pubchem kinds', () => {
  it('Network → network key, action=retry', () => {
    const m = mapIngestErrorToKey(wrap({ kind: 'Network', cause: 'x', retryable: true }));
    expect(m.key).toBe('common.ingest.error.pubchem.network');
    expect(m.action).toBe('retry');
  });

  it('Timeout → timeout key + elapsedMs param, action=retry', () => {
    const m = mapIngestErrorToKey(wrap({ kind: 'Timeout', elapsedMs: 5000, retryable: true }));
    expect(m.key).toBe('common.ingest.error.pubchem.timeout');
    expect(m.params).toEqual({ elapsedMs: 5000 });
    expect(m.action).toBe('retry');
  });

  it('RateLimited → rateLimited key, action=retry', () => {
    const m = mapIngestErrorToKey(
      wrap({ kind: 'RateLimited', retryAfterMs: null, retryable: true }),
    );
    expect(m.key).toBe('common.ingest.error.pubchem.rateLimited');
    expect(m.action).toBe('retry');
  });

  it('HttpStatus retryable=true → action=retry', () => {
    const m = mapIngestErrorToKey(
      wrap({ kind: 'HttpStatus', status: 503, bodyExcerpt: null, retryable: true }),
    );
    expect(m.key).toBe('common.ingest.error.pubchem.httpStatus');
    expect(m.params).toEqual({ status: 503 });
    expect(m.action).toBe('retry');
  });

  it('HttpStatus retryable=false → no action', () => {
    const m = mapIngestErrorToKey(
      wrap({ kind: 'HttpStatus', status: 404, bodyExcerpt: null, retryable: false }),
    );
    expect(m.action).toBeNull();
  });

  it('Schema → schema key, no action, no params', () => {
    const m = mapIngestErrorToKey(wrap({ kind: 'Schema', issues: [], retryable: false }));
    expect(m.key).toBe('common.ingest.error.pubchem.schema');
    expect(m.action).toBeUndefined();
    expect(m.params).toBeUndefined();
  });

  it('NotFound → notFound key + value param', () => {
    const m = mapIngestErrorToKey(
      wrap({ kind: 'NotFound', query: { type: 'cid', value: 962 }, retryable: false }),
    );
    expect(m.key).toBe('common.ingest.error.pubchem.notFound');
    expect(m.params).toEqual({ value: '962' });
  });

  it('RdkitFailed → rdkitFailed key + reason param', () => {
    const m = mapIngestErrorToKey(
      wrap({ kind: 'RdkitFailed', reason: 'embed failed', retryable: false }),
    );
    expect(m.key).toBe('common.ingest.error.pubchem.rdkitFailed');
    expect(m.params).toEqual({ reason: 'embed failed' });
  });

  it('Aborted → action=suppress (panel 가 toast skip)', () => {
    const m = mapIngestErrorToKey(wrap({ kind: 'Aborted', retryable: false }));
    expect(m.key).toBe('common.ingest.error.pubchem.aborted');
    expect(m.action).toBe('suppress');
  });
});
