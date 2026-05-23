import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@/types/settings';

import enCommon from './resources/en/common.json';
import koCommon from './resources/ko/common.json';
// Phase 11 — panels = 별도 ns (useTranslation('panels')). shortcuts = common
// ns 에 'shortcuts' 키로 병합 (phase-09 i18nLabelKey='shortcuts.${action}' 가
// 기본 ns 'common' 으로 t() 호출 → common.shortcuts.* 해소).
import enPanels from './resources/en/panels.json';
import koPanels from './resources/ko/panels.json';
import enShortcuts from './resources/en/shortcuts.json';
import koShortcuts from './resources/ko/shortcuts.json';

export type { Locale };
export { useTranslation } from 'react-i18next';

// Phase 15 — chemistry ns 삭제 (registry-driven naming.ts 가 element 이름 제공).
const resources = {
  en: {
    common: { ...enCommon, shortcuts: enShortcuts },
    panels: enPanels,
  },
  ko: {
    common: { ...koCommon, shortcuts: koShortcuts },
    panels: koPanels,
  },
} as const;

let initialized = false;

export async function initI18n(initialLocale: Locale): Promise<void> {
  if (initialized) {
    await setLocale(initialLocale);
    return;
  }
  initialized = true;

  await i18n.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'panels'],
    resources,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    ...(import.meta.env.DEV && {
      missingKeyHandler: (lngs: readonly string[], ns: string, key: string) => {
        console.warn(`[i18n] Missing key: ${ns}:${key} for ${lngs.join(',')}`);
      },
    }),
  });
}

export async function setLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
}

export function getLocale(): Locale {
  return (i18n.language as Locale) ?? 'en';
}

export { i18n };
