// Phase 08 §7.2 — viewport 공개 배럴. 외부(app/panels)는 항상 이 모듈만 import.
// poolRegistry / selectionGuard / HoverState 등은 내부 전용 (미노출).
export { default } from './Viewport';

export { computeMoleculeLayout, computeBBox, computeAggregateBBox } from './scene/layout';
export type { MoleculeLayoutTransform, MoleculeBBox } from './scene/layout';
export { detectWebGL2 } from './capability/webgl2';
export {
  viewportIdForAtom,
  viewportIdForBond,
  parseViewportId,
  parseSelectedAtoms,
} from './ids/viewportId';
export { atomIdToIndex, bondIdToIndex, atomIndexToId } from './ids/lookup';
export { getAtomIdFromIntersection, type PickedTarget } from './ids/picking';
export { useAtomMatrixSubscription } from './subscriptions/usePositionSubscription';
export type { PositionSubscriptionHandle } from './subscriptions/usePositionSubscription';
export { useFadeOnMount } from './_shared/useFadeOnMount';
export { DEFAULT_LOD_THRESHOLDS } from './_shared/types';
export type {
  LodThresholds,
  LodLevel,
  ViewportApi,
  ViewportProps,
  CaptureBlobOptions,
  ViewportAtomId,
  ViewportBondId,
  ViewportId,
  WebGLDetectResult, // Phase 10 §4.3 — useWebGL2Detection / WebGL2FallbackPage
} from './_shared/types';

// ── Phase 09 §7.2 추가 공개 경계 ──
// createUndoStack / useUndoStack 은 stores 레이어로 이전 (`@/stores` 배럴) —
// R3F 비의존 + phase-10/11/13 가 stores 싱글톤으로 참조 (architecture §4.1).
export {
  KEY_MAP,
  describeKey,
  installGlobalUndoShortcuts, // phase-10 §5.3 — installAppShortcuts 가 배럴로 소비
  type KeyBinding,
  type KeyActionId,
} from './interactions/shortcuts';
export type { BondCreateFlowApi, BondCreateFlowState } from './interactions/useBondCreateFlow';
export { isTextInputTarget } from './interactions/textInputGuard';
