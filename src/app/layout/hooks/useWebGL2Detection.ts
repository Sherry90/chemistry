// Phase 10 §2.1 — detectWebGL2() 1회 호출 + memo (부팅 가드, D5).
import { useMemo } from 'react';
import { detectWebGL2 } from '@/viewport';
import type { WebGLDetectResult } from '@/viewport';

export function useWebGL2Detection(): WebGLDetectResult {
  return useMemo(() => detectWebGL2(), []);
}
