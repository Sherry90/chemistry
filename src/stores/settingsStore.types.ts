// Phase 07 §4.5 — settingsStore 상태/상수.
// Theme/Locale/RenderMode/단위 타입은 Phase 01 `@/types/settings` 단일 정의를 재수출 (중복 금지).
import type { Theme, Locale, RenderMode, TemperatureUnit, PressureUnit } from '@/types/settings';

export type { Theme, Locale, RenderMode, TemperatureUnit, PressureUnit };

export interface UnitSystem {
  readonly temperature: TemperatureUnit;
  readonly pressure: PressureUnit;
}

export interface SettingsStoreState {
  readonly theme: Theme;
  readonly locale: Locale;
  readonly renderMode: RenderMode;
  readonly units: UnitSystem;
  readonly cvdMode: boolean; // 색약 모드 (architecture §3.5)
}

/** navigator.language 기반 fallback locale (Phase 01 §2.4 순서: ko* → ko, 그 외 → en). */
export function defaultLocale(): Locale {
  const lang =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language.toLowerCase()
      : 'en';
  return lang.startsWith('ko') ? 'ko' : 'en';
}

export function makeDefaultSettings(): SettingsStoreState {
  return {
    theme: 'system',
    locale: defaultLocale(),
    renderMode: 'ball-and-stick',
    units: { temperature: 'K', pressure: 'atm' },
    cvdMode: false,
  };
}

/** 안정 참조가 필요한 경우용 스냅샷 (locale 은 호출 시점 navigator 기준). */
export const DEFAULT_SETTINGS: SettingsStoreState = makeDefaultSettings();

/**
 * persist 키 — D5 확정.
 *  v0 (Phase 01): localStorage `chem.theme`, `chem.locale` (별도 키)
 *  v1 (Phase 07): localStorage `chem.settings` (단일 직렬화 객체)
 */
export const PERSIST_KEY = 'chem.settings';
export const PERSIST_VERSION = 1;
export const LEGACY_THEME_KEY = 'chem.theme';
export const LEGACY_LOCALE_KEY = 'chem.locale';

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';
export const isLocale = (v: unknown): v is Locale => v === 'ko' || v === 'en';
export const isRenderMode = (v: unknown): v is RenderMode =>
  v === 'ball-and-stick' || v === 'space-filling' || v === 'wireframe' || v === 'stick';

export function isValidSettings(s: unknown): s is SettingsStoreState {
  if (s == null || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  const units = o['units'];
  if (units == null || typeof units !== 'object') return false;
  const u = units as Record<string, unknown>;
  return (
    isTheme(o['theme']) &&
    isLocale(o['locale']) &&
    isRenderMode(o['renderMode']) &&
    (u['temperature'] === 'K' || u['temperature'] === 'C') &&
    (u['pressure'] === 'atm' || u['pressure'] === 'Pa') &&
    typeof o['cvdMode'] === 'boolean'
  );
}
