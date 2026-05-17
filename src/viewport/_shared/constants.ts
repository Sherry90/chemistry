// Phase 08 §6 — 뷰포트 수치 상수 (Å 좌표계, Phase 03 좌표 보존 P3).
export const BOND_RADIUS_ANGSTROM = 0.08;
export const BOND_PARALLEL_OFFSET = 0.18; // 이중/삼중 평행 변위
export const GROUP_PADDING_ANGSTROM = 4; // 다중 분자 셀 여백 (D2)
export const MIN_CAMERA_DISTANCE = 5;
export const CAMERA_DISTANCE_FACTOR = 2.5; // bbox.diagonal × 2.5 (P3)
export const DEFAULT_FOV = 35; // deg
/** 등각 3/4 방향 (정규화는 Camera 가 수행). */
export const DEFAULT_CAMERA_DIR: readonly [number, number, number] = [1, 0.8, 1];
/** ball-and-stick: 구 반지름 = covalentRadius(Å) × 본 스케일. */
export const ATOM_RADIUS_SCALE = 0.4;
/** aromatic dashed (D3). */
export const AROMATIC_DASH_SIZE = 0.05;
export const AROMATIC_GAP_SIZE = 0.03;
export const FADE_DURATION_MS = 150; // D11
