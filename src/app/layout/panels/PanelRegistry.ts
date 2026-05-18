// Phase 10 §5.2 — PanelRegistry. 부팅 시점 1회 채워진 후 불변 가정
// (useSyncExternalStore 미사용). 중복 등록 시 logger.warn + 마지막 우선.
import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { PanelKey } from '@/stores';
import { logger } from '@/utils/logger';
import type { PanelDefinition, PanelRegistryMap } from './types';

const registry: Record<string, PanelDefinition> = {};

export function registerPanel(def: PanelDefinition): void {
  const prev = registry[def.key];
  if (prev) {
    logger.warn('panel-registry.duplicate', {
      key: def.key,
      previous: prev.i18nTitleKey,
      next: def.i18nTitleKey,
    });
  }
  registry[def.key] = def;
}

export function getPanelRegistry(): PanelRegistryMap {
  return Object.freeze({ ...registry });
}

/** SidePanelHost / ModalHost 가 사용. key=null → undefined. */
export function usePanelDefinition(key: PanelKey | null): PanelDefinition | undefined {
  if (key == null) return undefined;
  return registry[key];
}

// React.lazy 컴포넌트를 panel key 단위 캐시 — 매 렌더 새 lazy 생성(무한 remount)
// + useMemo exhaustive-deps 경고 회피. def 는 부팅 후 불변 가정 (§5.2).
const lazyCache = new Map<string, ComponentType>();

export function lazyPanelComponent(def: PanelDefinition): ComponentType {
  let comp = lazyCache.get(def.key);
  if (!comp) {
    comp = lazy(def.load);
    lazyCache.set(def.key, comp);
  }
  return comp;
}

/** 테스트 전용 — 등록 + lazy 캐시 초기화. */
export function __resetPanelRegistry(): void {
  for (const k of Object.keys(registry)) delete registry[k];
  lazyCache.clear();
}
