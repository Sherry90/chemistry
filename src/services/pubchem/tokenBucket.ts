import type { PubChemError } from './errors';
import type { Result } from '@/types/result';

const CAPACITY = 5;
const REFILL_PER_SEC = 4;

interface WaitEntry {
  resolve: (result: Result<void, PubChemError>) => void;
  signal: AbortSignal | undefined;
}

let tokens = CAPACITY;
let lastRefill = Date.now();
const queue: WaitEntry[] = [];
let refillTimer: ReturnType<typeof setTimeout> | null = null;

function refill(): void {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(CAPACITY, tokens + elapsed * REFILL_PER_SEC);
  lastRefill = now;
}

function scheduleRefill(): void {
  if (refillTimer !== null) return;
  const msPerToken = 1000 / REFILL_PER_SEC;
  refillTimer = setTimeout(() => {
    refillTimer = null;
    refill();
    drainQueue();
  }, msPerToken);
}

function drainQueue(): void {
  while (queue.length > 0 && tokens >= 1) {
    refill();
    const entry = queue.shift()!;
    if (entry.signal?.aborted) {
      entry.resolve({ ok: false, error: { kind: 'Aborted', retryable: false } });
      continue;
    }
    tokens -= 1;
    entry.resolve({ ok: true, value: undefined });
  }
  if (queue.length > 0) {
    scheduleRefill();
  }
}

/**
 * Consume one token. Waits in FIFO queue if no tokens available.
 * Returns Aborted if signal fires while waiting.
 */
export function consumeToken(signal?: AbortSignal): Promise<Result<void, PubChemError>> {
  // Early guard: an already-aborted signal never re-fires its 'abort' event,
  // so an entry queued with it would hang. Reject promptly instead.
  if (signal?.aborted) {
    return Promise.resolve({ ok: false, error: { kind: 'Aborted', retryable: false } });
  }

  refill();

  if (tokens >= 1) {
    tokens -= 1;
    return Promise.resolve({ ok: true, value: undefined });
  }

  return new Promise<Result<void, PubChemError>>((resolve) => {
    const entry: WaitEntry = { resolve, signal };
    queue.push(entry);
    scheduleRefill();

    if (signal) {
      const onAbort = (): void => {
        const idx = queue.indexOf(entry);
        if (idx !== -1) queue.splice(idx, 1);
        resolve({ ok: false, error: { kind: 'Aborted', retryable: false } });
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/** Reset for testing. */
export function resetTokenBucket(): void {
  tokens = CAPACITY;
  lastRefill = Date.now();
  queue.length = 0;
  if (refillTimer !== null) {
    clearTimeout(refillTimer);
    refillTimer = null;
  }
}
