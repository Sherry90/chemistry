import { describe, it, expect } from 'vitest';
import type { PubChemError } from '@/services/pubchem/errors';
import { isRetryable, shouldRetryStatus } from '@/services/pubchem/errors';

describe('PubChemError discriminated union', () => {
  it('Network: retryable=true, has cause', () => {
    const e: PubChemError = { kind: 'Network', cause: 'ECONNRESET', retryable: true };
    expect(e.retryable).toBe(true);
    expect(e.cause).toBe('ECONNRESET');
    expect(isRetryable(e)).toBe(true);
  });

  it('Timeout: retryable=true, has elapsedMs', () => {
    const e: PubChemError = { kind: 'Timeout', elapsedMs: 10000, retryable: true };
    expect(e.retryable).toBe(true);
    expect(e.elapsedMs).toBe(10000);
  });

  it('RateLimited: retryable=true, retryAfterMs can be null', () => {
    const e1: PubChemError = { kind: 'RateLimited', retryAfterMs: 5000, retryable: true };
    const e2: PubChemError = { kind: 'RateLimited', retryAfterMs: null, retryable: true };
    expect(e1.retryAfterMs).toBe(5000);
    expect(e2.retryAfterMs).toBeNull();
  });

  it('HttpStatus: retryable depends on status', () => {
    const e5xx: PubChemError = {
      kind: 'HttpStatus',
      status: 503,
      bodyExcerpt: null,
      retryable: true,
    };
    const e4xx: PubChemError = {
      kind: 'HttpStatus',
      status: 400,
      bodyExcerpt: 'bad request',
      retryable: false,
    };
    expect(isRetryable(e5xx)).toBe(true);
    expect(isRetryable(e4xx)).toBe(false);
  });

  it('Schema: retryable=false, has issues', () => {
    const e: PubChemError = { kind: 'Schema', issues: [], retryable: false };
    expect(e.retryable).toBe(false);
    expect(isRetryable(e)).toBe(false);
  });

  it('NotFound: retryable=false, has query', () => {
    const e: PubChemError = {
      kind: 'NotFound',
      query: { type: 'cid', value: 12345 },
      retryable: false,
    };
    expect(e.query.type).toBe('cid');
    expect(e.query.value).toBe(12345);
  });

  it('RdkitFailed: retryable=false', () => {
    const e: PubChemError = { kind: 'RdkitFailed', reason: 'embed failed', retryable: false };
    expect(e.reason).toBe('embed failed');
    expect(isRetryable(e)).toBe(false);
  });

  it('Aborted: retryable=false', () => {
    const e: PubChemError = { kind: 'Aborted', retryable: false };
    expect(isRetryable(e)).toBe(false);
  });

  it('switch exhaustive check compiles', () => {
    function classify(e: PubChemError): string {
      switch (e.kind) {
        case 'Network':
          return 'net';
        case 'Timeout':
          return 'timeout';
        case 'RateLimited':
          return 'rate';
        case 'HttpStatus':
          return 'http';
        case 'Schema':
          return 'schema';
        case 'NotFound':
          return 'notfound';
        case 'RdkitFailed':
          return 'rdkit';
        case 'Aborted':
          return 'aborted';
      }
    }
    const e: PubChemError = { kind: 'Aborted', retryable: false };
    expect(classify(e)).toBe('aborted');
  });

  it('shouldRetryStatus: true for 429 and 5xx', () => {
    expect(shouldRetryStatus(429)).toBe(true);
    expect(shouldRetryStatus(500)).toBe(true);
    expect(shouldRetryStatus(503)).toBe(true);
    expect(shouldRetryStatus(400)).toBe(false);
    expect(shouldRetryStatus(404)).toBe(false);
    expect(shouldRetryStatus(200)).toBe(false);
  });
});
