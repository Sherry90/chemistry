// Phase 10 §6.1 / D1 / D6 / D8 / D17 — 최상위 레이아웃. 상단 Toolbar(56px) +
// 좌 Viewport + 우 docked 사이드패널 (react-resizable-panels v4). Modal/Toast/
// Loading portal. createUndoStack 1회 → 컨텍스트 노출 (Phase 11 Toolbar 공유).
//
// (v0.x 정합) react-resizable-panels v4 API: Group/Panel/Separator
//   (문서 §6.1 의 v2 PanelGroup/PanelResizeHandle 폐기). v4 는 string px size
//   지원 → D6 의 320/240/600px 를 percentage 근사 없이 정확 매핑 (§11 #2 해소).
//   createUndoStack 은 @/stores 배럴 경유 (phase-09 §12 정합 — @/stores/_shared
//   /undo deep-import 가드 회피; 문서 §6.1 의 deep 경로 대체).
import { useMemo } from 'react';
import type { ReactNode, Ref } from 'react';
import { Group, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { createUndoStack, setUndoDispatcher } from '@/stores';
import type { ViewportApi, KeyActionId } from '@/viewport';
import { TooltipProvider } from '@/components';
import { ToolbarSlot } from './ToolbarSlot';
import { SidePanelHost } from './SidePanelHost';
import { ModalHost } from './ModalHost';
import { ViewportHost } from './ViewportHost';
import { ToastContainer } from './ToastContainer';
import { LoadingOverlay } from './LoadingOverlay';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { UndoableDispatcherProvider } from './hooks/useUndoableDispatcher';
import { useInstallAppShortcuts } from './hooks/useInstallAppShortcuts';

export interface AppLayoutProps {
  /** Toolbar 내용. Phase 11 <ToolbarBar/> 주입. 미지정 시 빈 컨테이너. */
  readonly toolbar?: ReactNode | undefined;
  /** Viewport imperative API ref. Phase 11 ToolbarBar 가 동일 ref 양쪽 forward. */
  readonly viewportApiRef?: Ref<ViewportApi> | undefined;
  /** Phase 11 D-SHORTCUT-OPEN-STATE — KEY_MAP 비-undo global 바인딩 단일 통지
   *  (App.tsx 가 panels shortcutBus emitter 주입). */
  readonly onShortcutAction?: ((action: KeyActionId) => void) | undefined;
}

function AppLayoutInner({ toolbar, viewportApiRef, onShortcutAction }: AppLayoutProps) {
  useInstallAppShortcuts(onShortcutAction); // D8 / P6 + Phase 11 onAction

  return (
    <div className="flex h-screen flex-col bg-bg-canvas text-fg-primary">
      <PanelErrorBoundary slotName="toolbar">
        <ToolbarSlot>{toolbar}</ToolbarSlot>
      </PanelErrorBoundary>
      <Group orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel className="h-full">
          <PanelErrorBoundary slotName="viewport">
            <ViewportHost apiRef={viewportApiRef} />
          </PanelErrorBoundary>
        </Panel>
        <PanelResizeHandle
          id="sidepanel-resize-handle"
          className="w-1 cursor-col-resize bg-border transition-colors hover:bg-accent data-[resize-handle-active]:bg-accent"
        />
        <Panel defaultSize="320px" minSize="240px" maxSize="600px" collapsible className="h-full">
          <PanelErrorBoundary slotName="sidepanel">
            <SidePanelHost />
          </PanelErrorBoundary>
        </Panel>
      </Group>
      {/* portal 자식 — flex 영향 없음 */}
      <PanelErrorBoundary slotName="modal">
        <ModalHost />
      </PanelErrorBoundary>
      <ToastContainer />
      <LoadingOverlay variant="app" />
    </div>
  );
}

export default function AppLayout({ toolbar, viewportApiRef, onShortcutAction }: AppLayoutProps) {
  // D17: 1회 createUndoStack → 컨텍스트. TooltipProvider 루트 1회 (delay 200ms).
  // Phase 15 §5 retrofit — setUndoDispatcher 호출이 누락되어 있어 moleculeStore
  // 액션이 placeholder dispatcher 로 분기 (undo 스택 push 미발생). v1 wire-gap
  // 해소: 본 컴포넌트가 stack 을 만들면서 dispatcher 싱글톤도 swap (architecture
  // §3.8 / phase-09 §7.2 "createUndoStack() 결과 주입" 미수행 정합).
  const dispatcher = useMemo(() => {
    const d = createUndoStack({ capacity: 50, mergeWindowMs: 200 });
    setUndoDispatcher(d);
    return d;
  }, []);
  return (
    <UndoableDispatcherProvider dispatcher={dispatcher}>
      <TooltipProvider delayDuration={200}>
        <AppLayoutInner
          toolbar={toolbar}
          viewportApiRef={viewportApiRef}
          onShortcutAction={onShortcutAction}
        />
      </TooltipProvider>
    </UndoableDispatcherProvider>
  );
}
