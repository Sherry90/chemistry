// Phase 10 §8.1 U4 — cn (clsx + tailwind-merge).
import { describe, it, expect } from 'vitest';
import { cn } from '@/components/_shared/classNames';

describe('cn', () => {
  it('clsx 조건부 결합', () => {
    const off = false as boolean;
    expect(cn('a', off && 'b', 'c')).toBe('a c');
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });

  it('tailwind-merge 충돌 해소 (마지막 우선)', () => {
    expect(cn('p-4 p-6')).toBe('p-6');
    expect(cn('text-fg-muted', 'text-fg-primary')).toBe('text-fg-primary');
  });
});
