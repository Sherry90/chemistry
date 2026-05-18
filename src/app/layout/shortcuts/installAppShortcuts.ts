// Phase 10 §5.3 — Phase 09 installGlobalUndoShortcuts 호출 + cleanup aggregator.
// installGlobalUndoShortcuts 는 @/viewport 배럴 경유 (phase-09/10 정합: phase-09
// §7.2 가 미노출했으나 본 Phase 가 app-level install 로 필요 → 배럴 노출).
// UndoableDispatcher 는 @/stores 배럴 (phase-09 §12 정합 — deep import 가드 회피).
import { installGlobalUndoShortcuts } from '@/viewport';
import type { UndoableDispatcher } from '@/stores';

export interface InstallAppShortcutsOpts {
  readonly dispatcher: UndoableDispatcher;
}

/**
 * 미래 확장: Cmd+/ (도움말), Cmd+K (명령 팔레트) 등을 동일 cleanup-aggregator
 * 패턴으로 흡수. Phase 09 KEY_MAP 이 우선순위 1–3; 본 함수는 키 추가 없음.
 */
export function installAppShortcuts({ dispatcher }: InstallAppShortcutsOpts): () => void {
  const undoCleanup = installGlobalUndoShortcuts({ dispatcher });
  return () => {
    undoCleanup();
  };
}
