// Phase 08 §5.1 / §6.11 + Phase 09 §6.8 (D11) — <Canvas> 진입 + WebGL2 가드 +
// apiRef bridge + viewport-focused 단축키.
// (v0.x 정합) Phase 10 §6.1 이 AppLayout 에서 createUndoStack()+컨텍스트+
// installAppShortcuts(전역 단축키) 를 단일 소유한다. 이중 스택/리스너 방지를
// 위해 Phase 09 가 본 컴포넌트에 두었던 dispatcher/스택/전역단축키 useEffect 는
// 제거(AppLayout 가 인수 — phase-10 §12.2 정합). viewport-focused(β) 핸들러만
// 유지. <Viewport> 단독 마운트 시 dispatcher 는 placeholder (AppLayout 가 합성 루트).
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { detectWebGL2 } from './capability/webgl2';
import { Scene } from './scene/Scene';
import { atomPoolRegistry, bondPoolRegistry } from './_shared/poolRegistry';
import { DEFAULT_FOV } from './_shared/constants';
import { createViewportShortcutHandler } from './interactions/useViewportShortcuts';
import { viewportFocusProps } from './interactions/_focus';
import type { ViewportApi, ViewportProps } from './_shared/types';

const Viewport: React.FC<ViewportProps> = ({ apiRef: externalApiRef, fallback, className }) => {
  const apiRef = useRef<ViewportApi | null>(null);

  // 외부 apiRef + 내부 ref 동시 충족 (단축키 핸들러가 frame/reset 호출).
  const setApi = useCallback(
    (api: ViewportApi | null): void => {
      apiRef.current = api;
      if (typeof externalApiRef === 'function') externalApiRef(api);
      else if (externalApiRef)
        (externalApiRef as React.MutableRefObject<ViewportApi | null>).current = api;
    },
    [externalApiRef],
  );

  // HMR/unmount 안전망 — 모듈-레벨 레지스트리 stale entry 비우기 (§6.11.2).
  useEffect(() => {
    return () => {
      atomPoolRegistry.clearAll();
      bondPoolRegistry.clearAll();
    };
  }, []);

  // Viewport-focused 단축키 (β 스코프) — 포커스된 컨테이너 onKeyDown 위임.
  // 전역(α) undo/redo + createUndoStack 주입은 Phase 10 AppLayout 소유.
  const onKeyDown = useMemo(
    () =>
      createViewportShortcutHandler({
        frameActive: () => apiRef.current?.frameActive(),
        resetCamera: () => apiRef.current?.resetCamera(),
      }),
    [],
  );

  const webgl = detectWebGL2();
  if (!webgl.ok) {
    return <>{fallback ?? null}</>;
  }

  const focusProps = viewportFocusProps();
  return (
    // role="application" + tabIndex 로 키보드 위임 (β 스코프). 전체 a11y(axe)
    // 검증은 Phase 15 (§2.2).
    <div
      className={className}
      style={{ width: '100%', height: '100%' }}
      role={focusProps.role}
      tabIndex={focusProps.tabIndex}
      onKeyDown={onKeyDown}
      data-testid="viewport-canvas"
    >
      <Canvas
        dpr={[1, 2]}
        flat
        shadows={false}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: DEFAULT_FOV, position: [6, 4.8, 6], near: 0.1, far: 5000 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Scene apiRef={setApi} />
      </Canvas>
    </div>
  );
};

export default Viewport;
