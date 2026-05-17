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
} from './_shared/types';
