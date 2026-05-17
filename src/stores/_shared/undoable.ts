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

// ── Phase 09 — dispatcher 싱글톤 swap (phase-07 §6.4 / phase-11 §1942 패턴) ──
// 호출자(moleculeStore 액션, ViewportApiBridge)는 *안정* `dispatcher` 식별자를
// import 한다. 메소드 본문이 모듈-로컬 `current` 를 위임 read 하므로,
// `setUndoDispatcher` 가 내부 구현을 createUndoStack() 결과로 교체해도 호출자
// 코드는 한 줄도 바뀌지 않는다 (phase-11 §1942 "export 시점 swap, 호출자 무변경").
// createUndoStack 은 동일 stores 레이어(`./undo`)에 있어 레이어 위반 없음 —
// phase-09 §5.1 의 "교체" 약속을 식별자·인터페이스 동결로 충족 (DI 주입 지점은
// phase-09 = <Viewport>, phase-10 §6.6 = AppLayout UndoableDispatcherProvider).
let current: UndoableDispatcher = phase07PlaceholderDispatcher;

/**
 * 스토어/UI 가 import 하는 *안정* dispatcher (phase-07 §659–664 의 export 변수
 * 패턴). `setUndoDispatcher` 로 본 구현을 갈아끼워도 import 한 모든 호출자가
 * 즉시 새 구현을 사용 (ESM 라이브 바인딩 의존 없음).
 */
export const dispatcher: UndoableDispatcher = {
  dispatchUndoable: (meta, mutator) => current.dispatchUndoable(meta, mutator),
  undo: () => current.undo(),
  redo: () => current.redo(),
  canUndo: () => current.canUndo(),
  canRedo: () => current.canRedo(),
};

/** createUndoStack() 결과 주입 — phase-09 <Viewport>, phase-10 AppLayout. */
export function setUndoDispatcher(d: UndoableDispatcher): void {
  current = d;
}

/** unmount / 테스트 afterEach — placeholder 로 복귀 (R9). */
export function resetUndoDispatcher(): void {
  current = phase07PlaceholderDispatcher;
}

/** 현재 활성 dispatcher (테스트/디버그 전용 — 일반 코드는 `dispatcher` 사용). */
export function getActiveUndoDispatcher(): UndoableDispatcher {
  return current;
}

// ── Phase 09 ambient undo-group (P4 / D3 — 드래그 stream 합치기) ───────────
// Phase 09 P4/§6.2.2 는 드래그의 매 mousemove `moveAtom` 을 group 키
// `drag:${atomId}` 로 D3 합치기 하길 요구한다. 그러나 Phase 07 `moveAtom` 의
// meta 는 group 을 싣지 않으며 §1.3 가 "Phase 07 액션 본문 불변" 을 못박는다.
// 두 제약을 모두 지키기 위해, dispatcher 본 구현(createUndoStack)이 액션 meta
// 의 group 이 없을 때 *ambient* group 컨텍스트를 참조한다. 드래그 컨트롤러가
// drag begin/end 에서 begin/endUndoGroup 으로 컨텍스트를 설정 — Phase 07 액션
// 본문은 한 줄도 바뀌지 않는다 (meta 는 여전히 groupless).
let ambientGroup: string | null = null;

/** 드래그 begin — 이후 groupless 액션이 이 group 으로 D3 합치기. */
export function beginUndoGroup(key: string): void {
  ambientGroup = key;
}

/** 드래그 end / cancel — ambient group 해제. */
export function endUndoGroup(): void {
  ambientGroup = null;
}

/** createUndoStack 이 meta.group 부재 시 참조. */
export function getCurrentUndoGroup(): string | null {
  return ambientGroup;
}
