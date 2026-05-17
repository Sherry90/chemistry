// Phase 07 §5.6 — stores 공개 배럴. 외부(panels/viewport/app/io)는 *이 모듈만* import.
// 내부 모듈(`@/stores/moleculeStore` 등) 직접 import 는 ESLint 가드로 차단.

// ── 스토어 훅 ──
export { useMoleculeStore } from './moleculeStore';
export { useReactionStore } from './reactionStore';
export { useUiStore } from './uiStore';
export { useSettingsStore } from './settingsStore';

// ── State / Action 인터페이스 ──
export type { MoleculeStoreState, MoleculeStoreActions } from './moleculeStore';
export type { ReactionStoreState, ReactionStoreActions } from './reactionStore';
export type { UiStoreState, UiStoreActions } from './uiStore';
export type { SettingsStoreState, SettingsStoreActions } from './settingsStore';

// ── uiStore 보조 타입 (토스트/검색 패널 인계) ──
export type {
  Notification,
  NotificationLevel,
  PanelKey,
  CompoundSearchSlice,
  CompoundSearchMode,
} from './uiStore.types';

// ── settingsStore 보조 타입/상수 ──
export type { Theme, Locale, RenderMode, UnitSystem } from './settingsStore.types';
export { DEFAULT_SETTINGS } from './settingsStore.types';

// ── reactionStore 보조 타입/상수 ──
export type { Condition, ReactionResult } from './reactionStore.types';
export { DEFAULT_CONDITION } from './reactionStore.types';

// ── 공용 타입 ──
export type {
  AsyncState,
  AsyncStateLoading,
  AsyncStateError,
  IngestError,
  SerializedError,
  UndoableMeta,
  MoleculeId,
} from './_shared/types';
export { ASYNC_IDLE, newMoleculeId, moleculeIdForCid } from './_shared/types';

// ── 안정 selector (Phase 08/11/12/13 인계 표면) ──
export {
  selectActiveMolecule,
  selectMoleculeById,
  selectMoleculeIds,
  selectIngestState,
  selectMoleculeSnapshot,
  selectAtomLabelsOn,
  selectBackgroundOverride,
  selectActivePanel,
  selectIsGloballyLoading,
  selectNotifications,
  selectCompoundSearch,
  selectSelection,
  selectTheme,
  selectLocale,
  selectRenderMode,
  selectUnits,
  selectIsCvdOn,
  selectReactantIds,
  selectCondition,
  selectRunState,
  selectIsRunning,
  selectIsExperimental,
  selectThermoFlag,
  selectAppliedRuleId,
  selectLastResult,
  mapReactionErrorToKey,
} from './selectors';
export type { MoleculeSnapshot } from './selectors';

// ── Undoable 시스템 — swappable `dispatcher` 싱글톤 + createUndoStack 본 구현 ──
// `dispatcher`: 스토어/UI 가 쓰는 안정 식별자 (phase-11 §1942 패턴).
// setUndoDispatcher: createUndoStack() 결과 주입 (phase-09 <Viewport>,
// phase-10 §6.6 AppLayout). createUndoStack/useUndoStack 은 stores 레이어
// `./_shared/undo` (R3F 비의존 → architecture §4.1).
export type { UndoableActionKind, UndoableDispatcher } from './_shared/undoable';
export {
  phase07PlaceholderDispatcher,
  dispatcher,
  setUndoDispatcher,
  resetUndoDispatcher,
  getActiveUndoDispatcher,
  beginUndoGroup,
  endUndoGroup,
  getCurrentUndoGroup,
} from './_shared/undoable';
export { createUndoStack, clearActiveUndoStack, useUndoStack } from './_shared/undo';
export type { UndoStackOpts } from './_shared/undo';

// ── 알림 큐 상한 (Phase 11 토스트 컴포넌트 참고) ──
export { NOTIFICATION_QUEUE_MAX } from './_shared/notifications';
