// Phase 11 §4.5 / D-COMPOUND-SEARCH-DEBOUNCE — 단순 디바운스 (300ms).
import { useEffect, useState } from 'react';

export interface UseDebouncedQueryOptions<T> {
  readonly value: T;
  readonly delayMs: number;
}

export function useDebouncedQuery<T>({ value, delayMs }: UseDebouncedQueryOptions<T>): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const tid = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(tid);
  }, [value, delayMs]);
  return debounced;
}
