import { describe, it, expect } from 'vitest';
import { ASYNC_IDLE, assertNever, type AsyncState } from '@/stores/_shared/types';

describe('AsyncState', () => {
  it('ASYNC_IDLE is the idle variant', () => {
    expect(ASYNC_IDLE).toEqual({ kind: 'idle' });
  });

  it('discriminates by kind', () => {
    const s: AsyncState<number, string> = { kind: 'success', value: 42, settledAt: 1 };
    if (s.kind === 'success') expect(s.value).toBe(42);
    else throw new Error('wrong kind');
  });

  it('assertNever throws on unexpected variant', () => {
    expect(() => assertNever('x' as never)).toThrow();
  });
});
