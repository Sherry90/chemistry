// Phase 09 §7 — 진행 중 애니메이션 cancel 관리 (R4).
// mount/unmount 페이드 진행 중 같은 분자가 다시 추가/삭제될 때, 이전 타이머를
// 취소하고 새 fade 로 깔끔히 전환하기 위한 molId → cancel 레지스트리.
// animations 내부 전용 (eslint §7.1 가드).
const registry = new Map<string, () => void>();

export function registerAnimation(key: string, cancel: () => void): void {
  registry.get(key)?.(); // 이전 진행 중 애니메이션 취소 (R4)
  registry.set(key, cancel);
}

export function clearAnimation(key: string): void {
  registry.delete(key);
}

/** 진행 중 애니메이션 강제 취소 (예: 분자 재추가). */
export function cancelAnimation(key: string): void {
  const c = registry.get(key);
  if (c) {
    c();
    registry.delete(key);
  }
}

export function hasAnimation(key: string): boolean {
  return registry.has(key);
}

/** 테스트/HMR — 전체 비움. */
export function __resetAnimationRegistry(): void {
  for (const c of registry.values()) c();
  registry.clear();
}
