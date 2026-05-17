// Phase 07 §6.3 — settingsStore persist + v0→v1 마이그레이션.
//
// 함정: zustand persist 의 migrate 는 storage 에 값이 *있을 때만* 호출된다.
// v0 사용자는 `chem.settings` 부재 → persist 가 곧장 기본값으로 초기화 → migrate 미발화.
// 따라서 custom storage adapter 가 legacy 키(chem.theme/chem.locale)를 v0-shaped
// StorageValue 로 합성해 반환하고, 이후 persist 표준 경로(migrate→merge)가 발화한다.
//
// 손상 복구는 `merge` 에서 수행한다 (store 역참조 회피 — Phase 09/13 v2 도입에도 안전).
// 본 모듈은 SettingsStoreState 만 알고 전체 store 타입(actions 포함)은 모른다 → 순환 없음.
import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware';
import { logger } from '@/utils/logger';
import {
  LEGACY_LOCALE_KEY,
  LEGACY_THEME_KEY,
  PERSIST_KEY,
  PERSIST_VERSION,
  isLocale,
  isTheme,
  isValidSettings,
  makeDefaultSettings,
  type Locale,
  type SettingsStoreState,
  type Theme,
} from './settingsStore.types';

function tryParseJson<T>(raw: string | null, guard: (v: unknown) => v is T): T | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** persist 대상의 핵심 필드만 추린다 (actions 등 함수 제외). */
function pickSettings(s: SettingsStoreState): SettingsStoreState {
  return {
    theme: s.theme,
    locale: s.locale,
    renderMode: s.renderMode,
    units: { temperature: s.units.temperature, pressure: s.units.pressure },
    cvdMode: s.cvdMode,
  };
}

/**
 * v0-aware storage adapter — chem.settings 부재 + legacy 키 존재 시 v0 모양 StorageValue
 * 합성. v1 raw 가 있으면 그대로 우선 (롤백 후 재진입 사용자).
 */
export const legacyAwareStorage: PersistStorage<SettingsStoreState> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (raw) {
      try {
        return JSON.parse(raw) as StorageValue<SettingsStoreState>;
      } catch (e) {
        logger.warn('settingsStore: corrupted persist payload, falling back', {
          error: String(e),
        });
        return null;
      }
    }
    if (name !== PERSIST_KEY) return null;

    const legacyTheme = tryParseJson<Theme>(localStorage.getItem(LEGACY_THEME_KEY), isTheme);
    const legacyLocale = tryParseJson<Locale>(localStorage.getItem(LEGACY_LOCALE_KEY), isLocale);
    if (legacyTheme == null && legacyLocale == null) return null;

    const partial: Partial<SettingsStoreState> = {
      ...(legacyTheme != null ? { theme: legacyTheme } : {}),
      ...(legacyLocale != null ? { locale: legacyLocale } : {}),
    };
    return { state: partial as SettingsStoreState, version: 0 };
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

/**
 * settingsStore 전용 persist 옵션 팩토리.
 * `TFull` = state + actions 전체 store 타입 (settingsStore.ts 가 주입). 영속 형태는
 * SettingsStoreState 만 (PersistedState=SettingsStoreState) — 함수는 직렬화 안 함.
 */
export function makeSettingsPersistOptions<TFull extends SettingsStoreState>(): PersistOptions<
  TFull,
  SettingsStoreState
> {
  return {
    name: PERSIST_KEY,
    version: PERSIST_VERSION,
    storage: legacyAwareStorage,
    partialize: (s) => pickSettings(s),

    migrate: (persisted: unknown, version: number): SettingsStoreState => {
      const partial = (persisted ?? {}) as Partial<SettingsStoreState>;
      if (version >= PERSIST_VERSION) {
        return { ...makeDefaultSettings(), ...partial };
      }
      const next: { -readonly [K in keyof SettingsStoreState]: SettingsStoreState[K] } = {
        ...makeDefaultSettings(),
      };
      if (partial.theme !== undefined) {
        if (isTheme(partial.theme)) next.theme = partial.theme;
        else logger.warn('settingsStore: invalid legacy theme, ignoring', { value: partial.theme });
      }
      if (partial.locale !== undefined) {
        if (isLocale(partial.locale)) next.locale = partial.locale;
        else
          logger.warn('settingsStore: invalid legacy locale, ignoring', {
            value: partial.locale,
          });
      }
      return next;
    },

    /**
     * 손상 복구 단일 지점 — migrate/rehydrate 후 최종 검증.
     * 유효치 않으면 기본값 복귀 + 경고 (Phase 07 DoD).
     */
    merge: (persistedState: unknown, currentState: TFull): TFull => {
      const candidate: SettingsStoreState = {
        ...pickSettings(currentState),
        ...(persistedState as Partial<SettingsStoreState>),
      };
      if (isValidSettings(candidate)) {
        return { ...currentState, ...candidate };
      }
      logger.warn('settingsStore: rehydrated state invalid, falling back to defaults', {
        candidate,
      });
      return { ...currentState, ...makeDefaultSettings() };
    },

    onRehydrateStorage: () => (_state, error) => {
      if (error) logger.warn('settingsStore rehydrate failed', { error: String(error) });
    },
  };
}
