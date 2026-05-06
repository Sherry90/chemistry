import { getCached, setCached, getCachedRaw, setCachedRaw } from './cache.js';
import {
  RATE_BUCKET_CAPACITY,
  RATE_REFILL_PER_SEC,
  BACKOFF_INITIAL_MS,
  BACKOFF_MAX_MS,
  BACKOFF_MAX_RETRIES,
} from '../config.js';

/** Token bucket for rate limiting */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
    await sleep(waitMs);
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
  }
}

const bucket = new TokenBucket(RATE_BUCKET_CAPACITY, RATE_REFILL_PER_SEC);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string): Promise<T> {
  const cacheKey = `json:${url}`;
  const cached = await getCached<T>(cacheKey);
  if (cached !== null) return cached;

  let lastError: Error | null = null;
  let delay = BACKOFF_INITIAL_MS;

  for (let attempt = 0; attempt <= BACKOFF_MAX_RETRIES; attempt++) {
    await bucket.consume();
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 503) {
        if (attempt < BACKOFF_MAX_RETRIES) {
          await sleep(Math.min(delay, BACKOFF_MAX_MS));
          delay *= 2;
          continue;
        }
        throw new Error(`HTTP ${res.status} after ${BACKOFF_MAX_RETRIES} retries: ${url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      const data = (await res.json()) as T;
      await setCached(cacheKey, data);
      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < BACKOFF_MAX_RETRIES) {
        await sleep(Math.min(delay, BACKOFF_MAX_MS));
        delay *= 2;
      }
    }
  }
  throw lastError ?? new Error(`Failed to fetch: ${url}`);
}

export async function fetchText(url: string): Promise<string | null> {
  const cacheKey = `text:${url}`;
  const cached = await getCachedRaw(cacheKey);
  if (cached !== null) return cached;

  let delay = BACKOFF_INITIAL_MS;

  for (let attempt = 0; attempt <= BACKOFF_MAX_RETRIES; attempt++) {
    await bucket.consume();
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 503) {
        if (attempt < BACKOFF_MAX_RETRIES) {
          await sleep(Math.min(delay, BACKOFF_MAX_MS));
          delay *= 2;
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      const text = await res.text();
      await setCachedRaw(cacheKey, text);
      return text;
    } catch {
      if (attempt < BACKOFF_MAX_RETRIES) {
        await sleep(Math.min(delay, BACKOFF_MAX_MS));
        delay *= 2;
      }
    }
  }
  return null;
}
