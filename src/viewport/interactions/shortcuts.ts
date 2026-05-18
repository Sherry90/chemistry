// Phase 09 §4.3 / §4.4 / §5.2 / §5.5 / §6.8 (D10/D11) — 단축키 표 + 전역 설치.
// 두 스코프: 'global'(window listener + 텍스트 입력 가드) / 'viewport'(focused
// 컨테이너 onKeyDown). 라이브러리 0개 — native KeyboardEvent.
import { dispatcher as activeUndoDispatcher, type UndoableDispatcher } from '@/stores';
import { isTextInputTarget } from './textInputGuard';

export type KeyActionId =
  | 'undo'
  | 'redo'
  | 'navAtomNext'
  | 'navAtomPrev'
  | 'clearSelection'
  | 'deleteSelection'
  | 'createBondFromSelection'
  | 'setBondOrder1'
  | 'setBondOrder2'
  | 'setBondOrder3'
  | 'setBondOrderAromatic'
  | 'frameActive'
  | 'resetCamera'
  | 'showShortcutSheet'; // ⟵ Phase 11 retrofit (D-PANEL-SHORTCUTS, additive)

export interface KeyBinding {
  /** 고유 ID — i18n 키 + 도움말 표시. */
  readonly id: string;
  readonly scope: 'global' | 'viewport';
  /** true 면 이 binding 발화. OS 분기(Cmd vs Ctrl)·조합 모두 표현. */
  readonly matches: (e: KeyboardEvent) => boolean;
  readonly action: KeyActionId;
  /** shortcuts.{action} — 실제 문구는 Phase 11. */
  readonly i18nLabelKey: string;
}

const cmdCtrl = (e: KeyboardEvent): boolean => e.metaKey || e.ctrlKey;
const noMods = (e: KeyboardEvent): boolean => !e.metaKey && !e.ctrlKey && !e.altKey;
const keyIs = (e: KeyboardEvent, k: string): boolean => e.key.toLowerCase() === k;

function bind(
  action: KeyActionId,
  scope: KeyBinding['scope'],
  matches: KeyBinding['matches'],
): KeyBinding {
  return { id: action, scope, action, matches, i18nLabelKey: `shortcuts.${action}` };
}

export const KEY_MAP: ReadonlyArray<KeyBinding> = [
  // ── 전역 (우선 2, D10 가드 후) ──
  bind('undo', 'global', (e) => cmdCtrl(e) && keyIs(e, 'z') && !e.shiftKey && !e.altKey),
  bind(
    'redo',
    'global',
    (e) =>
      (cmdCtrl(e) && keyIs(e, 'z') && e.shiftKey && !e.altKey) ||
      (cmdCtrl(e) && keyIs(e, 'y') && !e.shiftKey && !e.altKey),
  ),
  // ── viewport-focused (우선 3) ──
  bind('navAtomNext', 'viewport', (e) => e.key === 'Tab' && !e.shiftKey && noMods(e)),
  bind('navAtomPrev', 'viewport', (e) => e.key === 'Tab' && e.shiftKey && noMods(e)),
  bind('clearSelection', 'viewport', (e) => e.key === 'Escape'),
  bind(
    'deleteSelection',
    'viewport',
    (e) => (e.key === 'Delete' || e.key === 'Backspace') && noMods(e),
  ),
  bind('createBondFromSelection', 'viewport', (e) => keyIs(e, 'b') && !e.shiftKey && noMods(e)),
  bind('setBondOrder1', 'viewport', (e) => e.key === '1' && noMods(e)),
  bind('setBondOrder2', 'viewport', (e) => e.key === '2' && noMods(e)),
  bind('setBondOrder3', 'viewport', (e) => e.key === '3' && noMods(e)),
  bind('setBondOrderAromatic', 'viewport', (e) => keyIs(e, 'a') && !e.shiftKey && noMods(e)),
  bind('frameActive', 'viewport', (e) => keyIs(e, 'f') && !e.shiftKey && noMods(e)),
  bind('resetCamera', 'viewport', (e) => keyIs(e, 'r') && !e.shiftKey && noMods(e)),
  // Phase 11 (D-PANEL-SHORTCUTS) — '?' (보통 Shift+/ 변환) global. text-input
  // gate 자동 적용. 디스패치는 installGlobalUndoShortcuts 의 onAction 콜백.
  bind('showShortcutSheet', 'global', (e) => e.key === '?'),
];

/** Toolbar(Phase 11) 도움말 표시용 OS-무관 힌트. 실제 라벨은 i18nLabelKey. */
export function describeKey(binding: KeyBinding): string {
  switch (binding.action) {
    case 'undo':
      return 'Cmd/Ctrl+Z';
    case 'redo':
      return 'Shift+Cmd/Ctrl+Z / Cmd/Ctrl+Y';
    case 'navAtomNext':
      return 'Tab';
    case 'navAtomPrev':
      return 'Shift+Tab';
    case 'clearSelection':
      return 'Esc';
    case 'deleteSelection':
      return 'Delete / Backspace';
    case 'createBondFromSelection':
      return 'B';
    case 'setBondOrder1':
      return '1';
    case 'setBondOrder2':
      return '2';
    case 'setBondOrder3':
      return '3';
    case 'setBondOrderAromatic':
      return 'A';
    case 'frameActive':
      return 'F';
    case 'resetCamera':
      return 'R';
    case 'showShortcutSheet':
      return '?';
  }
}

/**
 * 전역 (D10 가드 후만 발화) — <Viewport /> 마운트 시 1회 호출, unmount 시
 * 반환된 unsubscribe 호출 (§12 Phase 10 cleanup 계약).
 */
export function installGlobalUndoShortcuts(opts?: {
  readonly dispatcher?: UndoableDispatcher;
  /** Phase 11 (D-SHORTCUT-OPEN-STATE) — 비-undo global 바인딩 (showShortcutSheet
   *  등) 을 단일 리스너가 통지. KEY_MAP 단일 소스 유지 (Toolbar 별도 listener 금지). */
  readonly onAction?: (action: KeyActionId) => void;
}): () => void {
  const dispatcher = opts?.dispatcher ?? activeUndoDispatcher;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isTextInputTarget(e.target)) return; // D10
    for (const b of KEY_MAP) {
      if (b.scope !== 'global') continue;
      if (b.matches(e)) {
        e.preventDefault();
        if (b.action === 'undo') dispatcher.undo();
        else if (b.action === 'redo') dispatcher.redo();
        else opts?.onAction?.(b.action); // 비-undo global → 콜백
        return;
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
