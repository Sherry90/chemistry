// Phase 08 §6.1 — ambient + key + fill. 그림자/FOG 비활성 (P6).
import type * as React from 'react';

export function Lighting(): React.ReactElement {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[1, 2, 1]} intensity={0.8} castShadow={false} />
      <directionalLight position={[-1, -1, -1]} intensity={0.3} castShadow={false} />
    </>
  );
}
