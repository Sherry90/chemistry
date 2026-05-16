import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { pubchemFetch } from '@/services/pubchem/client';
import { consumeToken, resetTokenBucket } from '@/services/pubchem/tokenBucket';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const testUrl = `${BASE}/compound/cid/962/property/MolecularFormula/JSON`;

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  resetTokenBucket();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('pubchemFetch success', () => {
  it('returns ok: true for 200 response', async () => {
    server.use(http.get(testUrl, () => HttpResponse.json({ data: 'ok' })));
    const result = await pubchemFetch(testUrl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = await result.value.json();
      expect(data).toEqual({ data: 'ok' });
    }
  });
});

describe('pubchemFetch 404', () => {
  it('returns HttpStatus 404 (no retry)', async () => {
    let callCount = 0;
    server.use(
      http.get(testUrl, () => {
        callCount++;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const result = await pubchemFetch(testUrl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('HttpStatus');
      if (result.error.kind === 'HttpStatus') {
        expect(result.error.status).toBe(404);
        expect(result.error.retryable).toBe(false);
      }
    }
    expect(callCount).toBe(1); // no retry
  });
});

describe('pubchemFetch 5xx retry', () => {
  it('retries on 503 and succeeds on 3rd attempt', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    server.use(
      http.get(testUrl, () => {
        callCount++;
        if (callCount < 3) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ data: 'ok' });
      }),
    );

    const resultPromise = pubchemFetch(testUrl);
    // Advance timers for backoff delays
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(callCount).toBe(3);
    expect(result.ok).toBe(true);
  });

  it('fails after max retries with HttpStatus error', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    server.use(
      http.get(testUrl, () => {
        callCount++;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    const resultPromise = pubchemFetch(testUrl);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(callCount).toBe(4); // initial + 3 retries
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('HttpStatus');
    }
  });
});

describe('pubchemFetch 429 RateLimited', () => {
  it('returns RateLimited after max retries', async () => {
    vi.useFakeTimers();
    server.use(
      http.get(
        testUrl,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '1' },
          }),
      ),
    );

    const resultPromise = pubchemFetch(testUrl);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('RateLimited');
    }
  });
});

describe('pubchemFetch 429 Retry-After success (§8.3#2)', () => {
  it('honors Retry-After on first 429 then succeeds; fetch called 2x', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    server.use(
      http.get(testUrl, () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '1' } });
        }
        return HttpResponse.json({ data: 'ok' });
      }),
    );

    const resultPromise = pubchemFetch(testUrl);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(callCount).toBe(2); // initial 429 + retry 200
    expect(result.ok).toBe(true);
  });
});

describe('token bucket concurrency (§8.3#1)', () => {
  it('5 concurrent consumeToken resolve immediately, 6th waits ~250ms', async () => {
    vi.useFakeTimers();
    resetTokenBucket();

    const order: number[] = [];
    const calls = Array.from({ length: 6 }, (_, i) =>
      consumeToken().then((r) => {
        expect(r.ok).toBe(true);
        order.push(i);
      }),
    );

    // First 5 tokens are available synchronously (CAPACITY=5).
    await vi.advanceTimersByTimeAsync(0);
    expect(order.length).toBe(5);

    // 6th is queued; refill = 1000/REFILL_PER_SEC(4) = 250ms per token.
    await vi.advanceTimersByTimeAsync(250);
    await Promise.all(calls);
    expect(order.length).toBe(6);
  });
});

describe('pubchemFetch AbortSignal', () => {
  it('returns Aborted when signal is already aborted', async () => {
    server.use(http.get(testUrl, () => HttpResponse.json({})));
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await pubchemFetch(testUrl, ctrl.signal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Aborted');
    }
  });

  it('returns Aborted when signal fires mid-flight (§8.3#5)', async () => {
    server.use(
      http.get(testUrl, async () => {
        await delay(100);
        return HttpResponse.json({ data: 'late' });
      }),
    );
    const ctrl = new AbortController();
    const resultPromise = pubchemFetch(testUrl, ctrl.signal);
    setTimeout(() => ctrl.abort(), 10); // abort while fetch is in-flight
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Aborted');
    }
  });
});
