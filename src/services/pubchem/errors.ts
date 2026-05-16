import type { ZodIssue } from 'zod';

export type PubChemError =
  | { readonly kind: 'Network'; readonly cause: string; readonly retryable: true }
  | { readonly kind: 'Timeout'; readonly elapsedMs: number; readonly retryable: true }
  | {
      readonly kind: 'RateLimited';
      readonly retryAfterMs: number | null;
      readonly retryable: true;
    }
  | {
      readonly kind: 'HttpStatus';
      readonly status: number;
      readonly bodyExcerpt: string | null;
      readonly retryable: boolean;
    }
  | { readonly kind: 'Schema'; readonly issues: ReadonlyArray<ZodIssue>; readonly retryable: false }
  | {
      readonly kind: 'NotFound';
      readonly query: {
        readonly type: 'cid' | 'name' | 'inchiKey';
        readonly value: string | number;
      };
      readonly retryable: false;
    }
  | { readonly kind: 'RdkitFailed'; readonly reason: string; readonly retryable: false }
  | { readonly kind: 'Aborted'; readonly retryable: false };

export function isRetryable(err: PubChemError): boolean {
  return err.retryable;
}

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
