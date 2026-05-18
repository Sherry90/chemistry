// Phase 10 §4.1 — PanelDefinition. Phase 11 패널이 부팅 시 registerPanel 로 등록.
import type { ComponentType } from 'react';
import type { PanelKey } from '@/stores';

export type PanelMode = 'docked' | 'modal';

export interface PanelDefinition {
  readonly key: PanelKey;
  readonly mode: PanelMode;
  /** common.json 키 (예: 'panels.periodicTable.title'). */
  readonly i18nTitleKey: string;
  /** React.lazy 호환 동적 import. */
  readonly load: () => Promise<{ default: ComponentType }>;
}

// 일부 패널은 검증/테스트 단계에서 미등록 가능 → Partial. 'toolbar' 는 phase-11
// P2 의 직접 주입 결정으로 영구 미등록.
export type PanelRegistryMap = Readonly<Partial<Record<PanelKey, PanelDefinition>>>;
