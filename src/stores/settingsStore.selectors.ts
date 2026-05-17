// Phase 07 §5.4 — settingsStore selector helpers.
import type {
  SettingsStoreState,
  Theme,
  Locale,
  RenderMode,
  UnitSystem,
} from './settingsStore.types';

export const selectTheme = (s: SettingsStoreState): Theme => s.theme;
export const selectLocale = (s: SettingsStoreState): Locale => s.locale;
export const selectRenderMode = (s: SettingsStoreState): RenderMode => s.renderMode;
export const selectUnits = (s: SettingsStoreState): UnitSystem => s.units;
export const selectIsCvdOn = (s: SettingsStoreState): boolean => s.cvdMode;
