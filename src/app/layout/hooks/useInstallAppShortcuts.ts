// Phase 10 §6.6 / P6 — mount install + unmount cleanup (window listener 누수 0).
// Phase 11 retrofit: onShortcutAction 전달 (D-SHORTCUT-OPEN-STATE 단일 디스패치).
import { useEffect } from 'react';
import type { KeyActionId } from '@/viewport';
import { installAppShortcuts } from '../shortcuts/installAppShortcuts';
import { useUndoableDispatcher } from './useUndoableDispatcher';

export function useInstallAppShortcuts(onShortcutAction?: (action: KeyActionId) => void): void {
  const dispatcher = useUndoableDispatcher();
  useEffect(() => {
    const cleanup = installAppShortcuts({
      dispatcher,
      ...(onShortcutAction ? { onAction: onShortcutAction } : {}),
    });
    return cleanup;
  }, [dispatcher, onShortcutAction]);
}
