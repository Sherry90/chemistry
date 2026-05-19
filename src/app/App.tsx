// Phase 11 §6.10 retrofit — Phase 01/10 placeholder toolbar → <ToolbarBar/>.
// registerAllPanels() 부팅 1회 (render 前). onShortcutAction = panels
// shortcutBus emitter (D-SHORTCUT-OPEN-STATE 단일 디스패치 — KEY_MAP 단일 소스).
import { useRef } from 'react';
import { AppLayout, registerPanel } from '@/app/layout';
import { panelRegistrations, ToolbarBar, emitShortcutAction } from '@/panels';
import type { ViewportApi } from '@/viewport';

// 부팅 1회 — App 모듈 로드 시점 (render 前). registerPanel 호출은 app 레이어
// (App.tsx)가 수행 — panels→app/layout 상향 위반 회피 (registerAll 은 정의만).
for (const def of panelRegistrations) registerPanel(def);

export function App() {
  const viewportApiRef = useRef<ViewportApi | null>(null);
  return (
    <AppLayout
      viewportApiRef={viewportApiRef}
      onShortcutAction={emitShortcutAction}
      toolbar={<ToolbarBar apiRef={viewportApiRef} />}
    />
  );
}
