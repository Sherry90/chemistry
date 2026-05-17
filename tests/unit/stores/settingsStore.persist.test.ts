// Phase 07 §6.3 / §8.4 — persist v0→v1 마이그레이션 + 손상 복구.
// 스토어는 import 시점에 동기 rehydrate 되므로, localStorage 를 세팅한 뒤
// vi.resetModules() + dynamic import 로 시나리오별 신선한 store 를 만든다.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const warn = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
}));

async function freshStore() {
  vi.resetModules();
  const mod = await import('@/stores/settingsStore');
  return mod.useSettingsStore;
}

beforeEach(() => {
  localStorage.clear();
  warn.mockClear();
});

describe('settingsStore persist migration', () => {
  it('v0 theme + locale → migrated values', async () => {
    localStorage.setItem('chem.theme', '"dark"');
    localStorage.setItem('chem.locale', '"ko"');
    const store = await freshStore();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().locale).toBe('ko');
  });

  it('v0 theme only → locale falls back to navigator default', async () => {
    localStorage.setItem('chem.theme', '"dark"');
    const store = await freshStore();
    expect(store.getState().theme).toBe('dark');
    expect(['ko', 'en']).toContain(store.getState().locale);
  });

  it('new user (no legacy keys) → DEFAULT_SETTINGS', async () => {
    const store = await freshStore();
    expect(store.getState().theme).toBe('system');
  });

  it('valid v1 payload is kept as-is', async () => {
    localStorage.setItem(
      'chem.settings',
      JSON.stringify({
        state: {
          theme: 'dark',
          locale: 'ko',
          renderMode: 'ball-and-stick',
          units: { temperature: 'K', pressure: 'atm' },
          cvdMode: false,
        },
        version: 1,
      }),
    );
    const store = await freshStore();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().locale).toBe('ko');
  });

  it('corrupted v1 value → DEFAULT_SETTINGS + logger.warn', async () => {
    localStorage.setItem('chem.settings', '{"state":{"theme":"banana"}}');
    const store = await freshStore();
    expect(store.getState().theme).toBe('system');
    expect(warn).toHaveBeenCalled();
  });

  it('legacy keys are NOT deleted (rollback safety)', async () => {
    localStorage.setItem('chem.theme', '"dark"');
    await freshStore();
    expect(localStorage.getItem('chem.theme')).toBe('"dark"');
  });
});
