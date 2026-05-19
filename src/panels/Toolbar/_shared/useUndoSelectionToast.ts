// Phase 11 §6.13 D-UNDO-TOAST — undo 후 selection 손실 안내 (단일 관찰자,
// 트리거 출처 무관: Toolbar 버튼·Cmd+Z 둘 다 moleculeStore.undo() 거침 →
// lastUndoSeq 구독). 200ms throttle.
import { useEffect, useRef } from 'react';
import { useUiStore, useMoleculeStore } from '@/stores';

function hasSelection(sel: {
  readonly atomIds: readonly string[];
  readonly bondIds: readonly string[];
}): boolean {
  return sel.atomIds.length > 0 || sel.bondIds.length > 0;
}

export function useUndoSelectionToast(): void {
  const notify = useUiStore((s) => s.actions.notify);
  const lastToastTs = useRef(0);

  useEffect(() => {
    let prevSelectionNonEmpty = hasSelection(useUiStore.getState().selection);
    const unsubSel = useUiStore.subscribe(
      (s) => s.selection,
      (sel) => {
        prevSelectionNonEmpty = hasSelection(sel);
      },
    );
    const unsubUndo = useMoleculeStore.subscribe(
      (s) => s.lastUndoSeq,
      (seq, prevSeq) => {
        if (seq <= prevSeq) return; // undo 만 (redo/no-op 아님)
        if (prevSelectionNonEmpty && Date.now() - lastToastTs.current > 200) {
          notify({
            level: 'info',
            messageKey: 'panels:toolbar.undoSelectionRestored.notice',
            dismissAfterMs: 3000,
          });
          lastToastTs.current = Date.now();
        }
      },
    );
    return () => {
      unsubSel();
      unsubUndo();
    };
  }, [notify]);
}
