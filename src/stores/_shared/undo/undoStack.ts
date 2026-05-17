// Phase 09 §4.2 / §5.1 / §6.1 — UndoableDispatcher 본 구현.
// D1 full snapshot, D2 capacity=50 FIFO, D3 group 200ms 합치기, P7 redo clear.
// 위치: stores 레이어 (`@/stores/_shared/undo`) — createUndoStack 은 viewport/
// R3F 의존이 전혀 없는 순수 store snapshot 로직이므로 architecture §4.1 상
// 의존을 만족하는 가장 낮은 레이어에 둔다. phase-10 §6.6 / phase-11 §1942 /
// phase-13 §4.2 가 본 모듈을 stores 싱글톤으로 참조 (DI swap). undoable.ts 의
// `dispatcher` proxy 가 <Viewport>/AppLayout 마운트 시 setUndoDispatcher 로 주입.
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  getCurrentUndoGroup,
  type UndoableDispatcher,
  type UndoableMeta,
  type UndoableActionKind,
} from '../undoable';
import { readSnapshot as defaultRead, writeSnapshot as defaultWrite } from './snapshot';
import {
  DEFAULT_UNDO_STACK,
  type UndoEntry,
  type UndoSnapshot,
  type UndoStackState,
} from './types';

export interface UndoStackOpts {
  /** D2: 50. */
  readonly capacity?: number;
  /** D3: 200 ms. */
  readonly mergeWindowMs?: number;
  /** snapshot 채취 — 기본 moleculeStore.getState(). 테스트 주입 가능. */
  readonly readSnapshot?: () => UndoSnapshot;
  /** snapshot 복원 — 기본 moleculeStore.setState(...). */
  readonly writeSnapshot?: (snap: UndoSnapshot) => void;
  /** clock 주입 (테스트). 미지정 시 Date.now. */
  readonly now?: () => number;
}

/**
 * createUndoStack 의 반환 — Phase 07 `UndoableDispatcher` (§4.2 동결) 를 확장.
 * `flush`/`clear` 는 R9 (<Viewport /> unmount 정리) 가 필요로 하는 *구체* 추가
 * 메소드 — 동결 인터페이스는 불변(추가 아님), 구체 타입만 확장.
 */
export interface UndoStackController extends UndoableDispatcher {
  /** 진행 중 그룹을 즉시 past 로 확정. */
  flush(): void;
  /** 스택 전체 비움 (import / HMR / 테스트). */
  clear(): void;
  /** React-외 구독 — useUndoStack 훅 전용 (스택 상태 변화 시 발화). */
  subscribe(listener: () => void): () => void;
  getUndoFlags(): { readonly canUndo: boolean; readonly canRedo: boolean };
}

function dropOldest(entries: ReadonlyArray<UndoEntry>, capacity: number): ReadonlyArray<UndoEntry> {
  return entries.length <= capacity ? entries : entries.slice(entries.length - capacity);
}

export function createUndoStack(opts?: UndoStackOpts): UndoStackController {
  const capacity = opts?.capacity ?? 50;
  const mergeWindowMs = opts?.mergeWindowMs ?? 200;
  const read = opts?.readSnapshot ?? defaultRead;
  const write = opts?.writeSnapshot ?? defaultWrite;
  const clock = opts?.now ?? Date.now;

  const store = createStore<UndoStackState>()(
    subscribeWithSelector(() => ({ ...DEFAULT_UNDO_STACK })),
  );

  function flushPending(): void {
    const s = store.getState();
    if (s.pending == null) return;
    store.setState({
      past: dropOldest([...s.past, s.pending], capacity),
      future: [],
      pending: null,
    });
  }

  function dispatchUndoable<T>(
    meta: UndoableMeta & { kind: UndoableActionKind },
    mutator: () => T,
  ): T {
    const prev = read();
    const result = mutator(); // 호출자 액션 실행 (Phase 07 본문 그대로)
    const next = read();
    const now = clock();

    const s = store.getState();
    const pending = s.pending;
    // meta.group 없으면 ambient drag-group 참조 (P4 — Phase 07 moveAtom 은
    // groupless, 드래그 컨트롤러가 beginUndoGroup 으로 컨텍스트 설정).
    const group = meta.group ?? getCurrentUndoGroup() ?? null;

    if (
      pending != null &&
      group != null &&
      pending.group === group &&
      now - pending.lastAt < mergeWindowMs
    ) {
      // 합치기 — pending 의 next 만 갱신 (D3: 첫 prev + 마지막 next 보관).
      store.setState({ pending: { ...pending, next, lastAt: now } });
    } else {
      // 새 항목 시작 — 이전 pending flush (있으면).
      if (pending != null) {
        store.setState({
          past: dropOldest([...s.past, pending], capacity),
          future: [], // P7
          pending: null,
        });
      }
      store.setState({
        pending: { meta, group, firstAt: now, lastAt: now, prev, next },
      });
    }

    // 비-그룹 액션은 즉시 flush (단일 entry).
    if (group === null) flushPending();
    return result;
  }

  function undo(): void {
    flushPending();
    const s = store.getState();
    if (s.past.length === 0) return;
    const entry = s.past[s.past.length - 1]!;
    write(entry.prev);
    store.setState({
      past: s.past.slice(0, -1),
      future: [entry, ...s.future],
      pending: null,
    });
  }

  function redo(): void {
    flushPending();
    const s = store.getState();
    if (s.future.length === 0) return;
    const entry = s.future[0]!;
    write(entry.next);
    store.setState({
      past: dropOldest([...s.past, entry], capacity),
      future: s.future.slice(1),
      pending: null,
    });
  }

  // canUndo = past 비어있지 않거나 pending 존재 (§6.1.5).
  const canUndo = (): boolean => {
    const s = store.getState();
    return s.past.length > 0 || s.pending != null;
  };
  const canRedo = (): boolean => store.getState().future.length > 0;

  function clear(): void {
    store.setState({ ...DEFAULT_UNDO_STACK });
  }

  const controller: UndoStackController = {
    dispatchUndoable,
    undo,
    redo,
    canUndo,
    canRedo,
    flush: flushPending,
    clear,
    subscribe: (listener) => store.subscribe(listener),
    getUndoFlags: () => ({ canUndo: canUndo(), canRedo: canRedo() }),
  };
  registerActiveUndoStack(controller);
  return controller;
}

// ── useUndoStack 반응성 레지스트리 (§5.3 권장 1) ──────────────────────────
// imperative canUndo()/canRedo() 는 호출 시점 값. Phase 11 Toolbar 가 React
// 반응성으로 Undo/Redo 버튼을 토글하려면 활성 스택 변화를 구독해야 한다.
let activeController: UndoStackController | null = null;
const swapListeners = new Set<() => void>();
let cachedFlags: { readonly canUndo: boolean; readonly canRedo: boolean } = {
  canUndo: false,
  canRedo: false,
};

function recomputeFlags(): void {
  const f = activeController ? activeController.getUndoFlags() : { canUndo: false, canRedo: false };
  if (f.canUndo !== cachedFlags.canUndo || f.canRedo !== cachedFlags.canRedo) {
    cachedFlags = f; // 값 변화 시에만 새 참조 (useSyncExternalStore 안정성)
  }
}

function registerActiveUndoStack(c: UndoStackController): void {
  activeController = c;
  recomputeFlags();
  swapListeners.forEach((l) => l());
}

/** <Viewport /> unmount — 활성 스택 해제 (R9). */
export function clearActiveUndoStack(c: UndoStackController): void {
  if (activeController !== c) return;
  activeController = null;
  recomputeFlags();
  swapListeners.forEach((l) => l());
}

export function getUndoFlagsSnapshot(): {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
} {
  return cachedFlags;
}

export function subscribeUndoFlags(cb: () => void): () => void {
  let unsubStore = activeController?.subscribe(() => {
    recomputeFlags();
    cb();
  });
  const onSwap = (): void => {
    unsubStore?.();
    unsubStore = activeController?.subscribe(() => {
      recomputeFlags();
      cb();
    });
    cb();
  };
  swapListeners.add(onSwap);
  return () => {
    swapListeners.delete(onSwap);
    unsubStore?.();
  };
}
