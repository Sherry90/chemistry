// Phase 09 §7.2 — undo 공개 경계 (`@/stores/_shared/undo`).
// phase-10 §6.6 (AppLayout createUndoStack) / phase-11 (Toolbar useUndoStack) /
// phase-13 §4.2 (clear/flush retrofit) 가 본 경로로 참조. types/snapshot 은
// 내부 전용 (재노출 안 함). UndoableDispatcher 타입은 undoable.ts 가 소유 —
// 본 경로에서도 참조 가능하도록 재수출 (phase-10 import 호환).
export { createUndoStack, clearActiveUndoStack, type UndoStackOpts } from './undoStack';
export { useUndoStack } from './useUndoStack';
export type { UndoableDispatcher } from '../undoable';
