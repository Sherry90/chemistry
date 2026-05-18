// Phase 09 §8.7 — KEY_MAP 일관성 + OS 분기 + D10 가드 + 스코프.
import { describe, it, expect, vi } from 'vitest';
import {
  KEY_MAP,
  describeKey,
  installGlobalUndoShortcuts,
  type KeyActionId,
} from '@/viewport/interactions/shortcuts';
import type { UndoableDispatcher } from '@/stores';

const ALL_ACTIONS: ReadonlyArray<KeyActionId> = [
  'undo',
  'redo',
  'navAtomNext',
  'navAtomPrev',
  'clearSelection',
  'deleteSelection',
  'createBondFromSelection',
  'setBondOrder1',
  'setBondOrder2',
  'setBondOrder3',
  'setBondOrderAromatic',
  'frameActive',
  'resetCamera',
  'showShortcutSheet', // Phase 11 retrofit (D-PANEL-SHORTCUTS)
];

const ev = (init: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    key: '',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  }) as KeyboardEvent;

const bindingFor = (a: KeyActionId) => KEY_MAP.find((b) => b.action === a)!;

describe('KEY_MAP', () => {
  it('모든 binding 이 KeyActionId 와 1:1 (id 고유)', () => {
    const actions = KEY_MAP.map((b) => b.action).sort();
    expect(actions).toEqual([...ALL_ACTIONS].sort());
    expect(new Set(KEY_MAP.map((b) => b.id)).size).toBe(KEY_MAP.length);
    for (const b of KEY_MAP) expect(b.i18nLabelKey).toBe(`shortcuts.${b.action}`);
  });

  it('Cmd+Z (macOS) ≡ Ctrl+Z (Win/Linux) → undo', () => {
    const undo = bindingFor('undo');
    expect(undo.matches(ev({ key: 'z', metaKey: true }))).toBe(true);
    expect(undo.matches(ev({ key: 'z', ctrlKey: true }))).toBe(true);
    expect(undo.matches(ev({ key: 'z', metaKey: true, shiftKey: true }))).toBe(false);
  });

  it('Shift+Cmd+Z 와 Cmd+Y 모두 redo', () => {
    const redo = bindingFor('redo');
    expect(redo.matches(ev({ key: 'z', metaKey: true, shiftKey: true }))).toBe(true);
    expect(redo.matches(ev({ key: 'y', ctrlKey: true }))).toBe(true);
    expect(redo.matches(ev({ key: 'z', metaKey: true }))).toBe(false);
  });

  it('Tab / Shift+Tab 스코프 viewport, undo/redo 스코프 global', () => {
    expect(bindingFor('navAtomNext').scope).toBe('viewport');
    expect(bindingFor('navAtomPrev').matches(ev({ key: 'Tab', shiftKey: true }))).toBe(true);
    expect(bindingFor('undo').scope).toBe('global');
  });

  it('describeKey 가 모든 액션에 비어있지 않은 힌트', () => {
    for (const b of KEY_MAP) expect(describeKey(b).length).toBeGreaterThan(0);
  });
});

describe('installGlobalUndoShortcuts', () => {
  function fakeDispatcher() {
    const undo = vi.fn();
    const redo = vi.fn();
    const d: UndoableDispatcher = {
      dispatchUndoable: (_m, fn) => fn(),
      undo,
      redo,
      canUndo: () => false,
      canRedo: () => false,
    };
    return { d, undo, redo };
  }

  it('Cmd+Z (텍스트 입력 밖) → dispatcher.undo 호출', () => {
    const { d, undo } = fakeDispatcher();
    const off = installGlobalUndoShortcuts({ dispatcher: d });
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }),
    );
    expect(undo).toHaveBeenCalledOnce();
    off();
  });

  it('Shift+Cmd+Z → dispatcher.redo', () => {
    const { d, redo } = fakeDispatcher();
    const off = installGlobalUndoShortcuts({ dispatcher: d });
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }),
    );
    expect(redo).toHaveBeenCalledOnce();
    off();
  });

  it('텍스트 입력 안 Cmd+Z → 미발화 (D10)', () => {
    const { d, undo } = fakeDispatcher();
    const off = installGlobalUndoShortcuts({ dispatcher: d });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    expect(undo).not.toHaveBeenCalled();
    input.remove();
    off();
  });

  it('viewport-스코프 키 (Tab/B) 가 global keydown 으로 와도 미발화', () => {
    const { d, undo, redo } = fakeDispatcher();
    const off = installGlobalUndoShortcuts({ dispatcher: d });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    off();
  });

  it('unsubscribe 후 리스너 제거', () => {
    const { d, undo } = fakeDispatcher();
    const off = installGlobalUndoShortcuts({ dispatcher: d });
    off();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }),
    );
    expect(undo).not.toHaveBeenCalled();
  });
});
