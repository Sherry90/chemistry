import type { PubChemError } from './errors';
import type { Result } from '@/types/result';
import { shouldRetryStatus } from './errors';
import { consumeToken } from './tokenBucket';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_DELAYS_MS = [0, 1_000, 2_000, 4_000] as const;
const JITTER = 0.2;
const MAX_RETRY_AFTER_MS = 60_000;

function withJitter(ms: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER;
  return Math.round(ms * factor);
}

function parseRetryAfterMs(headers: Headers): number | null {
  const raw = headers.get('Retry-After');
  if (!raw) return null;
  const secs = parseFloat(raw);
  if (!isFinite(secs) || secs <= 0) return null;
  return Math.min(secs * 1000, MAX_RETRY_AFTER_MS);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function combineSignals(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal]);
  }
  // Fallback for environments without AbortSignal.any
  const ctrl = new AbortController();
  const done = (): void => ctrl.abort();
  signal.addEventListener('abort', done, { once: true });
  timeoutSignal.addEventListener('abort', done, { once: true });
  return ctrl.signal;
}

export async function pubchemFetch(
  url: string,
  signal?: AbortSignal,
): Promise<Result<Response, PubChemError>> {
  // Early guard: short-circuit immediately if the signal is already aborted,
  // before touching the token bucket (which can otherwise hang for a
  // pre-aborted signal that never re-fires its 'abort' event).
  if (signal?.aborted) {
    return { ok: false, error: { kind: 'Aborted', retryable: false } };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Rate limit token
    const tokenResult = await consumeToken(signal);
    if (!tokenResult.ok) return tokenResult;

    if (signal?.aborted) {
      return { ok: false, error: { kind: 'Aborted', retryable: false } };
    }

    const startMs = Date.now();
    try {
      const combined = combineSignals(signal);
      const res = await fetch(url, { signal: combined });

      if (res.status === 429) {
        const headerMs = parseRetryAfterMs(res.headers);
        const effectiveMs =
          attempt === 0 && headerMs != null
            ? headerMs
            : withJitter(BASE_DELAYS_MS[Math.min(attempt, MAX_RETRIES)] ?? 4_000);
        if (attempt < MAX_RETRIES) {
          await sleep(effectiveMs, signal);
          continue;
        }
        return {
          ok: false,
          error: { kind: 'RateLimited', retryAfterMs: headerMs, retryable: true },
        };
      }

      if (!res.ok) {
        const retryable = shouldRetryStatus(res.status);
        if (retryable && attempt < MAX_RETRIES) {
          const delay = withJitter(BASE_DELAYS_MS[Math.min(attempt + 1, MAX_RETRIES)] ?? 4_000);
          await sleep(delay, signal);
          continue;
        }
        let bodyExcerpt: string | null = null;
        try {
          bodyExcerpt = (await res.text()).slice(0, 500);
        } catch {
          // ignore
        }
        return {
          ok: false,
          error: { kind: 'HttpStatus', status: res.status, bodyExcerpt, retryable },
        };
      }

      return { ok: true, value: res };
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        const elapsedMs = Date.now() - startMs;
        // Distinguish timeout from user abort
        if (!signal?.aborted) {
          return { ok: false, error: { kind: 'Timeout', elapsedMs, retryable: true } };
        }
        return { ok: false, error: { kind: 'Aborted', retryable: false } };
      }
      const cause = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_RETRIES) {
        const delay = withJitter(BASE_DELAYS_MS[Math.min(attempt + 1, MAX_RETRIES)] ?? 4_000);
        try {
          await sleep(delay, signal);
        } catch {
          return { ok: false, error: { kind: 'Aborted', retryable: false } };
        }
        continue;
      }
      return { ok: false, error: { kind: 'Network', cause, retryable: true } };
    }
  }

  return { ok: false, error: { kind: 'Network', cause: 'Exhausted retries', retryable: true } };
}
