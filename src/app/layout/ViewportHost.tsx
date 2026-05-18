// Phase 10 §6.4 / P2 / D5 / D11 — Phase 08 <Viewport> 단일 lazy 마운트 위치.
// WebGL2 미지원 시 chunk 다운로드 회피 (부팅 가드) + 런타임 context-lost
// 이중 안전망 (Viewport 자체 fallback prop).
import { Suspense, lazy } from 'react';
import type { Ref } from 'react';
import type { ViewportApi } from '@/viewport';
import { useWebGL2Detection } from './hooks/useWebGL2Detection';
import { WebGL2FallbackPage } from './WebGL2FallbackPage';
import { LoadingOverlay } from './LoadingOverlay';

const Viewport = lazy(() => import('@/viewport'));

export interface ViewportHostProps {
  readonly apiRef?: Ref<ViewportApi> | undefined;
}

export function ViewportHost({ apiRef }: ViewportHostProps) {
  const detection = useWebGL2Detection();

  if (!detection.ok) {
    return <WebGL2FallbackPage result={detection} />;
  }

  return (
    <Suspense fallback={<LoadingOverlay variant="viewport" visible />}>
      <Viewport
        {...(apiRef ? { apiRef } : {})}
        fallback={<WebGL2FallbackPage result={detection} />}
        className="h-full w-full"
      />
    </Suspense>
  );
}
