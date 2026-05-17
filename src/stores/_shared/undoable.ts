// Phase 07 §4.2 / §6.4 — Undo/Redo 인터페이스 동결.
// 본 Phase 는 *어떤 액션이 undoable 인지* 와 *액션 메타 형태* 만 동결한다.
// 스택 자료구조 / 스냅샷 전략 / 메모리 한도는 Phase 09 가 동일 인터페이스로 인수.
import { logger } from '@/utils/logger';
import type { UndoableMeta } from './types';

export type { UndoableMeta };

/**
 * Undoable 액션 식별자 — architecture §3.8 의 동작에 1:1 대응 (9개, Phase 09 동결).
 * 주: `setActive` / `clear` 는 *비*-undoable 이다 (active 는 UI 포인터, clear 는 일괄 리셋).
 * 따라서 본 enum 에 포함되지 않는다 — Phase 09 가 혼동하지 않도록 명시.
 */
export type UndoableActionKind =
  | 'atom.add'
  | 'atom.remove'
  | 'atom.move'
  | 'bond.create'
  | 'bond.break'
  | 'bond.setOrder'
  | 'molecule.create'
  | 'molecule.replace'
  | 'molecule.remove';

export interface UndoableDispatcher {
  dispatchUndoable<T>(meta: UndoableMeta & { kind: UndoableActionKind }, mutator: () => T): T;
  undo(): void;
  redo(): void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
}

/**
 * Phase 07 placeholder — mutator 는 즉시 실행, 스택은 비어 있음 (canUndo/canRedo 항상 false).
 * Phase 09 가 같은 인터페이스로 stack 본 구현 + 단축키 바인딩 인수 (호출자 코드 변경 0).
 */
export const phase07PlaceholderDispatcher: UndoableDispatcher = {
  dispatchUndoable: (meta, mutator) => {
    logger.debug('undoable action dispatched (Phase 07 placeholder)', {
      kind: meta.kind,
      label: meta.labelKey,
    });
    return mutator();
  },
  undo: () => logger.debug('undo() called — Phase 09 가 인수'),
  redo: () => logger.debug('redo() called — Phase 09 가 인수'),
  canUndo: () => false,
  canRedo: () => false,
};
