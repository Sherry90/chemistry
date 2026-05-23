// Phase 10 §6.3 / D12 — modal 토글 플래그 ↔ Radix Dialog 양방향. Esc/외부클릭/
// 닫기는 Radix 가 처리 (phase-09 Esc=clearSelection 은 viewport-focused 라 분리).
import { Suspense } from 'react';
import { useUiStore } from '@/stores';
import type { PanelKey } from '@/stores';
import { Dialog, DialogContent } from '@/components';
import { getPanelRegistry, lazyPanelComponent } from './panels/PanelRegistry';
import { LoadingOverlay } from './LoadingOverlay';

function ModalSlot({
  panelKey,
  open,
  onOpenChange,
}: {
  readonly panelKey: PanelKey;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const def = getPanelRegistry()[panelKey];
  const modal = def && def.mode === 'modal' ? def : null;
  if (!modal) return null;
  const LazyPanel = lazyPanelComponent(modal); // key 단위 캐시 (모듈 레벨)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent i18nTitleKey={modal.i18nTitleKey} size="lg">
        <Suspense fallback={<LoadingOverlay variant="panel" visible />}>
          <LazyPanel />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

export function ModalHost() {
  const isPeriodicTableOpen = useUiStore((s) => s.panels.isPeriodicTableOpen);
  const isCompoundBrowserOpen = useUiStore((s) => s.panels.isCompoundBrowserOpen);
  const isReactionResultOpen = useUiStore((s) => s.panels.isReactionResultOpen);
  const isTextInputOpen = useUiStore((s) => s.panels.isTextInputOpen);
  const togglePeriodicTable = useUiStore((s) => s.actions.togglePeriodicTable);
  const toggleCompoundBrowser = useUiStore((s) => s.actions.toggleCompoundBrowser);
  const toggleReactionResult = useUiStore((s) => s.actions.toggleReactionResult);
  const toggleTextInput = useUiStore((s) => s.actions.toggleTextInput);

  return (
    <>
      <ModalSlot
        panelKey="periodic-table"
        open={isPeriodicTableOpen}
        onOpenChange={(o) => !o && togglePeriodicTable(false)}
      />
      <ModalSlot
        panelKey="compound-browser"
        open={isCompoundBrowserOpen}
        onOpenChange={(o) => !o && toggleCompoundBrowser(false)}
      />
      <ModalSlot
        panelKey="reaction-result"
        open={isReactionResultOpen}
        onOpenChange={(o) => !o && toggleReactionResult(false)}
      />
      {/* Phase 15 §6.1 retrofit — phase-12 `text-input` panel 등록 후 ModalHost
          미연결 (v1 bug). isTextInputOpen → Radix Dialog 양방향. */}
      <ModalSlot
        panelKey="text-input"
        open={isTextInputOpen}
        onOpenChange={(o) => !o && toggleTextInput(false)}
      />
    </>
  );
}
