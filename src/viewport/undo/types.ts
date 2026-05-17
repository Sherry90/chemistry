// Phase 09 §4.1 — Undo 자료구조. molecules/ids/activeId 만 snapshot (UI/reaction/
// settings 보존, D14). D1+P6: full snapshot — immer 구조적 공유로 변경 안 된
// 분자/원자/결합은 prev/next 가 같은 참조 → 메모리 0 추가.
import type { MoleculeStoreState, UndoableMeta, UndoableActionKind } from '@/stores';

export interface UndoSnapshot {
  readonly molecules: MoleculeStoreState['molecules'];
  readonly ids: MoleculeStoreState['ids'];
  readonly activeId: MoleculeStoreState['activeId'];
}

/** 스택 항목: 한 그룹의 *시작 직전* prev 와 *마지막* next (D3 — 중간 폐기). */
export interface UndoEntry {
  readonly meta: UndoableMeta & { readonly kind: UndoableActionKind };
  readonly group: string | null; // meta.group ?? null
  readonly firstAt: number; // 그룹 시작 시각 (ms)
  readonly lastAt: number; // 그룹 마지막 액션 시각 (ms)
  readonly prev: UndoSnapshot; // 그룹 시작 직전
  readonly next: UndoSnapshot; // 그룹 마지막 액션 직후
}

export interface UndoStackState {
  readonly past: ReadonlyArray<UndoEntry>; // 오래된 → 최근. capacity 초과 시 head drop
  readonly future: ReadonlyArray<UndoEntry>; // redo 용. 새 액션 시 비움 (P7)
  /** 진행 중 그룹의 작성-중 마지막 액션 — 다음 액션이 동일 group + 200ms 안이면 합침. */
  readonly pending: UndoEntry | null;
}

export const DEFAULT_UNDO_STACK: UndoStackState = {
  past: [],
  future: [],
  pending: null,
};
