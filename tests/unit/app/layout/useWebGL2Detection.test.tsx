// Phase 10 §8.1 U3 — detectWebGL2 1회 호출 + memo (재렌더 시 재호출 0).
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { detectWebGL2 } = vi.hoisted(() => ({
  detectWebGL2: vi.fn(() => ({ ok: true, maxTextureSize: 4096 })),
}));
vi.mock('@/viewport', () => ({ detectWebGL2 }));

import { useWebGL2Detection } from '@/app/layout/hooks/useWebGL2Detection';

describe('useWebGL2Detection', () => {
  it('memo — 재렌더에도 detectWebGL2 1회', () => {
    const { result, rerender } = renderHook(() => useWebGL2Detection());
    expect(result.current).toEqual({ ok: true, maxTextureSize: 4096 });
    rerender();
    rerender();
    expect(detectWebGL2).toHaveBeenCalledTimes(1);
  });
});
