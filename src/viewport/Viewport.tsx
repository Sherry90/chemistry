// Phase 08 §5.1 / §6.11 (D6/D7/D14) — <Canvas> 진입 + WebGL2 가드 + apiRef bridge.
import type * as React from 'react';
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { detectWebGL2 } from './capability/webgl2';
import { Scene } from './scene/Scene';
import { atomPoolRegistry, bondPoolRegistry } from './_shared/poolRegistry';
import { DEFAULT_FOV } from './_shared/constants';
import type { ViewportProps } from './_shared/types';

const Viewport: React.FC<ViewportProps> = ({ apiRef, fallback, className }) => {
  // HMR/unmount 안전망 — 모듈-레벨 레지스트리 stale entry 비우기 (§6.11.2).
  useEffect(() => {
    return () => {
      atomPoolRegistry.clearAll();
      bondPoolRegistry.clearAll();
    };
  }, []);

  const webgl = detectWebGL2();
  if (!webgl.ok) {
    return <>{fallback ?? null}</>;
  }

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
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
        <Scene apiRef={apiRef} />
      </Canvas>
    </div>
  );
};

export default Viewport;
