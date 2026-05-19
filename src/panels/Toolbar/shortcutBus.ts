// Phase 11 D-SHORTCUT-OPEN-STATE — KEY_MAP 단일 소스 유지용 경량 pub/sub.
// installAppShortcuts(onAction) 단일 글로벌 리스너가 비-undo 바인딩을 emit,
// Toolbar(AppGroup)가 subscribe → 로컬 Popover 토글. 별도 keydown listener 금지.
import type { KeyActionId } from '@/viewport';

type Listener = (action: KeyActionId) => void;
const listeners = new Set<Listener>();

export function emitShortcutAction(action: KeyActionId): void {
  for (const l of listeners) l(action);
}

export function subscribeShortcutAction(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
