// Phase 11 §5.3 — ToolbarBar props.
import type { RefObject } from 'react';
import type { ViewportApi } from '@/viewport';

export interface ToolbarProps {
  /** App.tsx 가 useRef 로 생성, <AppLayout viewportApiRef> 와 본 prop 양쪽 forward.
   *  null = viewport 미마운트/WebGL2 미지원 → viewport 액션 버튼 disabled. */
  readonly apiRef: RefObject<ViewportApi | null>;
}
