// Phase 14 §4.5 — performance.mark 래퍼 (개발 빌드만).
const IS_DEV = import.meta.env.DEV;

export function markStart(label: string): void {
  if (IS_DEV) performance.mark(`${label}:start`);
}

export function markEnd(label: string): void {
  if (!IS_DEV) return;
  performance.mark(`${label}:end`);
  performance.measure(label, `${label}:start`, `${label}:end`);
  const entries = performance.getEntriesByName(label, 'measure');
  const last = entries[entries.length - 1];
  if (last && last.duration > 50) {
    console.warn(`[perf] ${label}: ${last.duration.toFixed(1)} ms (> 50 ms 예산 초과)`);
  }
}
