export type CacheErrorKind = 'QuotaExceeded' | 'BlockedUpgrade' | 'Unknown';

export interface CacheError {
  readonly kind: CacheErrorKind;
  readonly message: string;
  readonly cause?: unknown;
}

export function toCacheError(cause: unknown): CacheError {
  if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
    return { kind: 'QuotaExceeded', message: 'IndexedDB quota exceeded', cause };
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return { kind: 'Unknown', message, cause };
}
