// Phase 07 §5.6 — 후속 Phase 가 쓰는 안정 selector 의 단일 재수출 묶음.
export {
  selectActiveMolecule,
  selectMoleculeById,
  selectMoleculeIds,
  selectIngestState,
  selectMoleculeSnapshot,
  selectAllMoleculeSnapshots, // Phase 13 §4.8 retrofit
  selectBondMetrics, // Phase 11 §4.7 retrofit
  mapIngestErrorToKey, // Phase 12 §6.11 retrofit
  mapExportErrorToKey, // Phase 13 §6.13 retrofit
  mapImportErrorToKey, // Phase 13 §6.13 retrofit
  mapIoErrorToKey, // Phase 13 §6.13 retrofit
} from './moleculeStore.selectors';
export type { MoleculeSnapshot } from './moleculeStore.selectors';
export type { BondMetric, BondAngleMetric, BondMetricsResult } from './moleculeStore.selectors';
export type { IngestErrorMapping } from './moleculeStore.selectors';
export type { IoErrorMapping } from './moleculeStore.selectors';

export {
  selectAtomLabelsOn,
  selectBackgroundOverride,
  selectActivePanel,
  selectIsGloballyLoading,
  selectNotifications,
  selectCompoundSearch,
  selectSelection,
  selectHasSelection, // Phase 11 §6.13 retrofit
  selectIsTextInputOpen, // Phase 12
  selectTextInputInitial, // Phase 12
  selectIsIoOpen, // Phase 13
  selectIoInitialMode, // Phase 13
} from './uiStore.selectors';

export {
  selectTheme,
  selectLocale,
  selectRenderMode,
  selectUnits,
  selectIsCvdOn,
} from './settingsStore.selectors';

export {
  selectReactantIds,
  selectCondition,
  selectRunState,
  selectIsRunning,
  selectIsExperimental,
  selectThermoFlag,
  selectAppliedRuleId,
  selectLastResult,
  mapReactionErrorToKey,
} from './reactionStore.selectors';
