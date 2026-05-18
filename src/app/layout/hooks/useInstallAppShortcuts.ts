// Phase 10 §6.6 / P6 — mount install + unmount cleanup (window listener 누수 0).
import { useEffect } from 'react';
import { installAppShortcuts } from '../shortcuts/installAppShortcuts';
import { useUndoableDispatcher } from './useUndoableDispatcher';

export function useInstallAppShortcuts(): void {
  const dispatcher = useUndoableDispatcher();
  useEffect(() => {
    const cleanup = installAppShortcuts({ dispatcher });
    return cleanup;
  }, [dispatcher]); // dispatcher 컨텍스트 안정(D17) → mount/unmount 1회
}
