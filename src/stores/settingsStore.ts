// Phase 07 §4.5 / §5.4 — settingsStore. persist 미들웨어 적용 유일 스토어 (D5).
import { createAppStore } from './_shared/createStore';
import { makeSettingsPersistOptions } from './settingsStore.persist';
import {
  makeDefaultSettings,
  type RenderMode,
  type SettingsStoreState,
  type Locale,
  type Theme,
} from './settingsStore.types';

export type { SettingsStoreState };

export interface SettingsStoreActions {
  setTheme(theme: Theme): void;
  setLocale(locale: Locale): void;
  setRenderMode(mode: RenderMode): void;
  setTemperatureUnit(unit: 'K' | 'C'): void;
  setPressureUnit(unit: 'atm' | 'Pa'): void;
  toggleCvdMode(on?: boolean): void;
  resetToDefaults(): void;
}

export type SettingsStore = SettingsStoreState & {
  readonly actions: SettingsStoreActions;
};

export const useSettingsStore = createAppStore<SettingsStore, SettingsStoreState>(
  'settingsStore',
  (set) => ({
    ...makeDefaultSettings(),
    actions: {
      setTheme: (theme) =>
        set((s) => {
          s.theme = theme;
        }),
      setLocale: (locale) =>
        set((s) => {
          s.locale = locale;
        }),
      setRenderMode: (mode) =>
        set((s) => {
          s.renderMode = mode;
        }),
      setTemperatureUnit: (unit) =>
        set((s) => {
          s.units.temperature = unit;
        }),
      setPressureUnit: (unit) =>
        set((s) => {
          s.units.pressure = unit;
        }),
      toggleCvdMode: (on) =>
        set((s) => {
          s.cvdMode = on ?? !s.cvdMode;
        }),
      resetToDefaults: () =>
        set((s) => {
          const d = makeDefaultSettings();
          s.theme = d.theme;
          s.locale = d.locale;
          s.renderMode = d.renderMode;
          s.units = d.units;
          s.cvdMode = d.cvdMode;
        }),
    },
  }),
  makeSettingsPersistOptions<SettingsStore>(),
);
