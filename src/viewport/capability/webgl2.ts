// Phase 08 §6.11.1 (D6) — WebGL2 + WASM 감지. 모듈-레벨 캐시 (재호출 무비용).
import type { WebGLDetectResult } from '../_shared/types';

let cached: WebGLDetectResult | null = null;

export function detectWebGL2(): WebGLDetectResult {
  if (cached) return cached;
  cached = compute();
  return cached;
}

/** 테스트 전용 — 캐시 리셋. */
export function __resetWebGL2Cache(): void {
  cached = null;
}

function compute(): WebGLDetectResult {
  if (typeof WebAssembly === 'undefined') {
    return { ok: false, reason: 'no-wasm' };
  }
  if (typeof document === 'undefined') {
    return { ok: false, reason: 'context-creation-failed' };
  }
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  } catch {
    canvas.remove();
    return { ok: false, reason: 'context-creation-failed' };
  }
  if (!gl) {
    canvas.remove();
    return { ok: false, reason: 'no-webgl2' };
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const lose = gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null;
  lose?.loseContext();
  canvas.remove();
  return { ok: true, maxTextureSize };
}
