import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';
import { makeDefaultSettings, PERSIST_KEY } from '@/stores/settingsStore.types';
import { hardReset } from './_helpers';

beforeEach(() => {
  localStorage.clear();
  hardReset(useSettingsStore, makeDefaultSettings);
});

describe('settingsStore', () => {
  it('defaults: theme=system, renderMode=ball-and-stick, cvd off', () => {
    const s = useSettingsStore.getState();
    expect(s.theme).toBe('system');
    expect(s.renderMode).toBe('ball-and-stick');
    expect(s.cvdMode).toBe(false);
    expect(['ko', 'en']).toContain(s.locale);
  });

  it('setTheme persists to chem.settings localStorage key', () => {
    useSettingsStore.getState().actions.setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
    const raw = localStorage.getItem(PERSIST_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.theme).toBe('dark');
  });

  it('unit toggles update nested units', () => {
    useSettingsStore.getState().actions.setTemperatureUnit('C');
    useSettingsStore.getState().actions.setPressureUnit('Pa');
    expect(useSettingsStore.getState().units).toEqual({ temperature: 'C', pressure: 'Pa' });
  });

  it('toggleCvdMode flips / forces', () => {
    useSettingsStore.getState().actions.toggleCvdMode();
    expect(useSettingsStore.getState().cvdMode).toBe(true);
    useSettingsStore.getState().actions.toggleCvdMode(true);
    expect(useSettingsStore.getState().cvdMode).toBe(true);
  });

  it('resetToDefaults restores and re-persists', () => {
    useSettingsStore.getState().actions.setTheme('dark');
    useSettingsStore.getState().actions.resetToDefaults();
    expect(useSettingsStore.getState().theme).toBe('system');
    expect(JSON.parse(localStorage.getItem(PERSIST_KEY)!).state.theme).toBe('system');
  });
});
