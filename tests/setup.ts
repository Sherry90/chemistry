import process from 'node:process';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Test-infra noise filter: fake-indexeddb + idb surface an unhandled
// `AbortError` from `FDBTransaction.error` when an open IndexedDB transaction
// is torn down (afterEach swaps `new IDBFactory()` / aborts mid-op). Aborts
// are an *expected, asserted* behavior here (product code converts them to
// `{ kind: 'Aborted' }` Results). Swallow ONLY AbortError; re-surface every
// other unhandled rejection so genuine bugs still fail the run.
process.on('unhandledRejection', (reason: unknown) => {
  if ((reason as { name?: string } | null)?.name === 'AbortError') return;
  throw reason;
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
