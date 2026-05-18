// Phase 10 §8.1 U2 — registerPanel 중복 warn + usePanelDefinition + lazy 캐시.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@/utils/logger', () => ({ logger: { warn, error: vi.fn(), debug: vi.fn() } }));

import {
  registerPanel,
  getPanelRegistry,
  usePanelDefinition,
  lazyPanelComponent,
  __resetPanelRegistry,
} from '@/app/layout/panels/PanelRegistry';
import type { PanelDefinition } from '@/app/layout/panels/types';

const def = (over: Partial<PanelDefinition> = {}): PanelDefinition => ({
  key: 'periodic-table',
  mode: 'docked',
  i18nTitleKey: 'panels.periodicTable.title',
  load: () => Promise.resolve({ default: () => null }),
  ...over,
});

beforeEach(() => {
  __resetPanelRegistry();
  warn.mockClear();
});

describe('PanelRegistry', () => {
  it('register → getPanelRegistry / usePanelDefinition 조회', () => {
    registerPanel(def());
    expect(getPanelRegistry()['periodic-table']?.mode).toBe('docked');
    expect(usePanelDefinition('periodic-table')?.i18nTitleKey).toBe('panels.periodicTable.title');
    expect(usePanelDefinition(null)).toBeUndefined();
  });

  it('중복 key → logger.warn 1회 + 마지막 우선', () => {
    registerPanel(def({ i18nTitleKey: 'a' }));
    registerPanel(def({ i18nTitleKey: 'b' }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('panel-registry.duplicate', expect.any(Object));
    expect(getPanelRegistry()['periodic-table']?.i18nTitleKey).toBe('b');
  });

  it('getPanelRegistry 결과는 frozen', () => {
    registerPanel(def());
    expect(Object.isFrozen(getPanelRegistry())).toBe(true);
  });

  it('lazyPanelComponent key 단위 캐시 — 동일 참조', () => {
    const d = def();
    registerPanel(d);
    expect(lazyPanelComponent(d)).toBe(lazyPanelComponent(d));
  });
});
