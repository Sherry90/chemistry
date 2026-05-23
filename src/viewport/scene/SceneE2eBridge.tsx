// Phase 15 hotfix A — E2E camera bridge. `?e2e=1` 인 경우만 useThree 의 camera/gl 을
// window.__e2e_three__ 에 노출. Playwright 가 atom world-coord → screen pixel 변환에 사용.
// 평시 빌드: URL 파라미터 검사 후 effect 미진입 (dead code 효과).
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';

declare global {
  interface Window {
    __e2e_three__?: {
      camera: THREE.Camera;
      gl: THREE.WebGLRenderer;
    };
  }
}

export function SceneE2eBridge(): null {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') !== '1') return;
    window.__e2e_three__ = { camera, gl };
    return () => {
      delete window.__e2e_three__;
    };
  }, [camera, gl]);
  return null;
}
