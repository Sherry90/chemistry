// Phase 10 §5.1 — @/app/layout 공개 배럴. 내부 hooks/PanelRegistry mutable
// state / theme.css 미노출.
export { default as AppLayout } from './AppLayout';
export type { AppLayoutProps } from './AppLayout';

export { ToolbarSlot } from './ToolbarSlot';
export { SidePanelHost } from './SidePanelHost';
export { ModalHost } from './ModalHost';
export { ViewportHost } from './ViewportHost';
export { ToastContainer } from './ToastContainer';
export { LoadingOverlay } from './LoadingOverlay';
export type { LoadingOverlayProps, LoadingOverlayVariant } from './LoadingOverlay';
export { WebGL2FallbackPage } from './WebGL2FallbackPage';
export type { WebGL2FallbackPageProps } from './WebGL2FallbackPage';
export { AppErrorBoundary } from './AppErrorBoundary';
export type { AppErrorFallbackProps } from './AppErrorBoundary';
export { PanelErrorBoundary } from './PanelErrorBoundary';
export type { PanelErrorFallbackProps, SlotName } from './PanelErrorBoundary';

// PanelRegistry API
export { registerPanel, getPanelRegistry, usePanelDefinition } from './panels/PanelRegistry';
export type { PanelDefinition, PanelMode, PanelRegistryMap } from './panels/types';

// 단축키
export { installAppShortcuts } from './shortcuts/installAppShortcuts';
export type { InstallAppShortcutsOpts } from './shortcuts/installAppShortcuts';

// dispatcher 컨텍스트 (Phase 11 Toolbar)
export { UndoableDispatcherProvider, useUndoableDispatcher } from './hooks/useUndoableDispatcher';
