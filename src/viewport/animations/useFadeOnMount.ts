// Phase 09 §5.7 / §6.7 (D15) — mount fade-in 본 구현 (Phase 08 stub 인수).
// 표면(반환 형태)은 Phase 08 그대로: { opacity, transparent:true }.
// useFrame 으로 clock 기반 보간 → React state 1개(opacity)만 갱신.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { fadeProgress } from './easing';

export interface UseFadeOnMountOpts {
  readonly durationMs?: number; // 기본 150 (D15)
  readonly onCompleted?: () => void;
}

export function useFadeOnMount(opts?: UseFadeOnMountOpts): {
  readonly opacity: number;
  readonly transparent: true;
} {
  const durationMs = opts?.durationMs ?? 150;
  const [opacity, setOpacity] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useFrame(({ clock }) => {
    if (doneRef.current) return;
    const nowMs = clock.elapsedTime * 1000;
    if (startedAtRef.current == null) startedAtRef.current = nowMs;
    const elapsed = nowMs - startedAtRef.current;
    const p = fadeProgress(elapsed, durationMs);
    setOpacity(p);
    if (p >= 1) {
      doneRef.current = true;
      opts?.onCompleted?.();
    }
  });

  return { opacity, transparent: true };
}
