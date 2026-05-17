// Phase 09 §7 — 순수 easing 함수 (R3F/DOM 비의존).
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

/** mount fade-in 진행도 — D15 (opacity 0→1, easeInOutCubic). */
export function fadeProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return easeInOutCubic(elapsedMs / durationMs);
}

/** unmount fade-out 진행도 — D15 (opacity 1→0). */
export function exitOpacity(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return 1 - easeInOutCubic(elapsedMs / durationMs);
}
