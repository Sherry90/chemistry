import { describe, it, expect, vi } from 'vitest';
import { phase07PlaceholderDispatcher } from '@/stores/_shared/undoable';

describe('phase07PlaceholderDispatcher', () => {
  it('runs the mutator immediately and returns its value', () => {
    const mutator = vi.fn(() => 7);
    const out = phase07PlaceholderDispatcher.dispatchUndoable(
      { undoable: true, kind: 'atom.move', labelKey: 'stores.undo.atomMove' },
      mutator,
    );
    expect(mutator).toHaveBeenCalledOnce();
    expect(out).toBe(7);
  });

  it('canUndo / canRedo are always false in Phase 07', () => {
    expect(phase07PlaceholderDispatcher.canUndo()).toBe(false);
    expect(phase07PlaceholderDispatcher.canRedo()).toBe(false);
  });

  it('undo / redo are no-ops (do not throw)', () => {
    expect(() => phase07PlaceholderDispatcher.undo()).not.toThrow();
    expect(() => phase07PlaceholderDispatcher.redo()).not.toThrow();
  });
});
