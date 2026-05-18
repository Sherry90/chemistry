// Phase 10 §2.1 / D1 — Toolbar 가로 컨테이너 (높이 56px 고정). 자식은 Phase 11
// <ToolbarBar/> 주입. 미지정 시 빈 컨테이너 (높이만 유지).
import type { ReactNode } from 'react';

export function ToolbarSlot({ children }: { readonly children?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg-panel px-3">
      {children}
    </div>
  );
}
