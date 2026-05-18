// Phase 10 §8.1 U1 / R7 / P6 — installAppShortcuts → installGlobalUndoShortcuts
// 위임 + cleanup aggregator.
import { describe, it, expect, vi } from 'vitest';

const { undoCleanup, installGlobalUndoShortcuts } = vi.hoisted(() => {
  const c = vi.fn();
  return { undoCleanup: c, installGlobalUndoShortcuts: vi.fn(() => c) };
});
vi.mock('@/viewport', () => ({ installGlobalUndoShortcuts }));

import { installAppShortcuts } from '@/app/layout/shortcuts/installAppShortcuts';
import type { UndoableDispatcher } from '@/stores';

const fakeDispatcher = {
  dispatchUndoable: (_m: unknown, fn: () => unknown) => fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: () => false,
  canRedo: () => false,
} as unknown as UndoableDispatcher;

describe('installAppShortcuts', () => {
  it('install → installGlobalUndoShortcuts(dispatcher) 호출; cleanup → undo cleanup', () => {
    const cleanup = installAppShortcuts({ dispatcher: fakeDispatcher });
    expect(installGlobalUndoShortcuts).toHaveBeenCalledWith({ dispatcher: fakeDispatcher });
    expect(undoCleanup).not.toHaveBeenCalled();
    cleanup();
    expect(undoCleanup).toHaveBeenCalledOnce();
  });
});
