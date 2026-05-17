// Phase 08 §5.7 (D11) — mount/unmount fade hook.
// 본 Phase 는 *상수* 반환 (애니메이션 없음). Phase 09 가 0.15s opacity 본 구현 인수.
export interface UseFadeOnMountOpts {
  readonly durationMs?: number; // 기본 150 (Phase 09 가 사용)
  readonly onCompleted?: () => void;
}

export function useFadeOnMount(_opts?: UseFadeOnMountOpts): {
  readonly opacity: number;
  readonly transparent: true;
} {
  return { opacity: 1, transparent: true };
}
