// Phase 08 §4 — viewport 공용 타입 (Phase 01 식별 모델 소비, 본 Phase 재정의 아님).
import type * as React from 'react';
import type * as THREE from 'three';
import type { AtomId, BondId, MoleculeId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';

// ── composite ViewportId (uiStore.selection 저장 형태, §4.1) ──
export type ViewportAtomId = `${string}::a:${string}`;
export type ViewportBondId = `${string}::b:${string}`;

export type ViewportId =
  | { readonly kind: 'atom'; readonly molId: MoleculeId; readonly atomId: AtomId }
  | { readonly kind: 'bond'; readonly molId: MoleculeId; readonly bondId: BondId };

// ── LOD (§4.3) ──
export type LodLevel = 'high' | 'low';

export interface LodThresholds {
  readonly atomCountForLowSegments: number;
  readonly atomCountForLineBonds: number;
}

/** Phase 14 가 튜닝, 본 Phase 는 보수적 디폴트. */
export const DEFAULT_LOD_THRESHOLDS: LodThresholds = {
  atomCountForLowSegments: 300,
  atomCountForLineBonds: 1500,
};

/** settingsStore RenderMode 와 동일 별칭 — 본 Phase 는 ball-and-stick 한 갈래. */
export type RenderMode = 'ball-and-stick';

// ── Background 해상 (§4.4) ──
export const THEME_LIGHT_BG = '#FFFFFF' as const;
export const THEME_DARK_BG = '#0E1116' as const;

export type BackgroundResolved =
  | { readonly mode: 'theme-light'; readonly hex: typeof THEME_LIGHT_BG }
  | { readonly mode: 'theme-dark'; readonly hex: typeof THEME_DARK_BG }
  | { readonly mode: 'override-light'; readonly hex: typeof THEME_LIGHT_BG }
  | { readonly mode: 'override-dark'; readonly hex: typeof THEME_DARK_BG };

// ── ViewportApi (§4.5, D14) ──
export interface CaptureBlobOptions {
  readonly format: 'png'; // v1 PNG 전용 (Phase 13 이 widen)
  readonly dpr?: number;
  readonly transparentBackground?: boolean; // 디폴트 false
}

export interface ViewportApi {
  frameActive(): void;
  frameAll(): void;
  resetCamera(): void;
  captureBlob(opts: CaptureBlobOptions): Promise<Blob>;
  getRenderer(): THREE.WebGLRenderer | null;

  // ── Phase 09 가 stub 본문만 교체 (인터페이스는 본 Phase 소유·동결) ──
  canUndo: () => boolean;
  canRedo: () => boolean;
  createBondFromSelection: () => boolean;
}

// ── <Viewport /> props (§5.1) ──
export interface ViewportProps {
  readonly apiRef?: React.Ref<ViewportApi>;
  readonly fallback?: React.ReactNode;
  readonly className?: string;
}

// ── HoverState (로컬, D10) ──
export interface HoverState {
  readonly molId: MoleculeId;
  readonly atomId: AtomId;
  readonly screen: readonly [number, number];
}

// ── WebGL 가능성 (§4.8) ──
export type WebGLDetectResult =
  | { readonly ok: true; readonly maxTextureSize: number }
  | {
      readonly ok: false;
      readonly reason: 'no-webgl2' | 'no-wasm' | 'context-creation-failed';
    };

// ── InstancedMesh 풀 (§4.6, D9+D9a) ──
export type AtomPoolUserData = {
  readonly kind: 'atomPool';
  readonly element: ElementNumber;
  readonly molId: MoleculeId;
};
export type BondPoolUserData = {
  readonly kind: 'bondPool';
  readonly molId: MoleculeId;
};

export interface AtomInstancePool {
  readonly element: ElementNumber;
  readonly molId: MoleculeId;
  mesh: THREE.InstancedMesh;
  /** slot → AtomId. [0,used) 만 유효. */
  readonly instanceIdToAtomId: Array<AtomId | undefined>;
  readonly atomIdToSlot: Map<AtomId, number>;
  capacity: number;
  used: number;
}

export interface BondInstancePool {
  readonly molId: MoleculeId;
  mesh: THREE.InstancedMesh;
  readonly instanceIdToBondId: Array<BondId | undefined>;
  /** BondId → 점유 cylinder 슬롯들 (order/split 에 따라 2~6). */
  readonly bondIdToSlots: Map<BondId, ReadonlyArray<number>>;
  capacity: number;
  used: number;
}
