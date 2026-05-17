// Phase 09 §8.8 — easing + fade/exit 진행도 순수 검증.
import { describe, it, expect } from 'vitest';
import {
  easeInOutCubic,
  easeOutCubic,
  easeInCubic,
  fadeProgress,
  exitOpacity,
} from '@/viewport/animations/easing';

describe('easing', () => {
  it('easeInOutCubic 경계: 0→0, 0.5→0.5, 1→1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('범위 밖 입력 clamp', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    expect(easeOutCubic(-5)).toBe(0);
    expect(easeInCubic(9)).toBe(1);
  });

  it('easeOutCubic / easeInCubic 단조 증가', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.3)).toBeGreaterThan(easeInCubic(0.3)); // out > in 초반
    expect(easeInCubic(0)).toBe(0);
    expect(easeInCubic(1)).toBe(1);
  });

  it('fadeProgress: 0ms→0, 75/150→0.5, 150→1, duration 0→1', () => {
    expect(fadeProgress(0, 150)).toBe(0);
    expect(fadeProgress(75, 150)).toBeCloseTo(0.5, 6);
    expect(fadeProgress(150, 150)).toBe(1);
    expect(fadeProgress(999, 150)).toBe(1);
    expect(fadeProgress(10, 0)).toBe(1);
  });

  it('exitOpacity: 0ms→1, 75→~0.5, 150→0', () => {
    expect(exitOpacity(0, 150)).toBe(1);
    expect(exitOpacity(75, 150)).toBeCloseTo(0.5, 6);
    expect(exitOpacity(150, 150)).toBe(0);
    expect(exitOpacity(5, 0)).toBe(0);
  });
});
