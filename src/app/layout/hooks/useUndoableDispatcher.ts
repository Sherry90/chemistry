// Phase 10 §5.5 / D17 — dispatcher React 컨텍스트. AppLayout 가 1회
// createUndoStack() 후 Provider 로 노출. Phase 11 Toolbar 가 동일 인스턴스 참조.
// UndoableDispatcher 는 @/stores 배럴 경유 (phase-09 §12 정합 — @/stores/* deep
// import 가드 회피; 문서 §5.5 의 @/stores/_shared/undo 직접 경로 대체).
import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';
import type { UndoableDispatcher } from '@/stores';

const Ctx = createContext<UndoableDispatcher | null>(null);

export function UndoableDispatcherProvider({
  dispatcher,
  children,
}: {
  readonly dispatcher: UndoableDispatcher;
  readonly children: ReactNode;
}): ReturnType<typeof createElement> {
  return createElement(Ctx.Provider, { value: dispatcher }, children);
}

/** AppLayout 외부 호출 시 throw (R12 — 명시 에러). */
export function useUndoableDispatcher(): UndoableDispatcher {
  const ctx = useContext(Ctx);
  if (ctx == null) {
    throw new Error(
      'useUndoableDispatcher: <UndoableDispatcherProvider> 외부에서 사용 불가 (AppLayout 트리 내부 전용)',
    );
  }
  return ctx;
}
