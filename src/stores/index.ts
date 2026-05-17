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

// ── Undoable 시스템 — Phase 09 가 dispatcher 본 구현을 DI 로 주입 ──
// undoDispatcher: 스토어/뷰포트가 쓰는 안정 proxy. setUndoDispatcher: viewport
// 마운트가 createUndoStack() 결과 주입 (stores→viewport 레이어 위반 회피).
export type { UndoableActionKind, UndoableDispatcher } from './_shared/undoable';
export {
  phase07PlaceholderDispatcher,
  undoDispatcher,
  setUndoDispatcher,
  resetUndoDispatcher,
  getActiveUndoDispatcher,
  beginUndoGroup,
  endUndoGroup,
  getCurrentUndoGroup,
} from './_shared/undoable';

// ── 알림 큐 상한 (Phase 11 토스트 컴포넌트 참고) ──
export { NOTIFICATION_QUEUE_MAX } from './_shared/notifications';
