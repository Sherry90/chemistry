// Phase 07 §5.6 — 후속 Phase 가 쓰는 안정 selector 의 단일 재수출 묶음.
export {
  selectActiveMolecule,
  selectMoleculeById,
  selectMoleculeIds,
  selectIngestState,
  selectMoleculeSnapshot,
  selectBondMetrics, // Phase 11 §4.7 retrofit
} from './moleculeStore.selectors';
export type { MoleculeSnapshot } from './moleculeStore.selectors';
export type { BondMetric, BondAngleMetric, BondMetricsResult } from './moleculeStore.selectors';

export {
  selectAtomLabelsOn,
  selectBackgroundOverride,
  selectActivePanel,
  selectIsGloballyLoading,
  selectNotifications,
  selectCompoundSearch,
  selectSelection,
  selectHasSelection, // Phase 11 §6.13 retrofit
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
