import type { LookupResult } from './types';

const map = new Map<number, Promise<LookupResult>>();

export function getInflight(cid: number): Promise<LookupResult> | undefined {
  return map.get(cid);
}

export function setInflight(cid: number, promise: Promise<LookupResult>): void {
  map.set(cid, promise);
  promise.finally(() => {
    if (map.get(cid) === promise) map.delete(cid);
  });
}

/** Reset for testing. */
export function resetInflight(): void {
  map.clear();
}
