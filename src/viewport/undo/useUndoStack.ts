// Phase 09 §5.3 권장 (1) — Toolbar(Phase 11)의 Undo/Redo 버튼 활성/비활성을
// React 반응성으로 토글하기 위한 selector 훅. imperative viewportApi.canUndo()/
// canRedo() 는 호출 시점 값 — 변화 자동 리렌더 없음.
import { useSyncExternalStore } from 'react';
import { getUndoFlagsSnapshot, subscribeUndoFlags } from './undoStack';

export function useUndoStack(): { readonly canUndo: boolean; readonly canRedo: boolean } {
  return useSyncExternalStore(subscribeUndoFlags, getUndoFlagsSnapshot, getUndoFlagsSnapshot);
}
