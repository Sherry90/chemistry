import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@/types/settings';

import enCommon from './resources/en/common.json';
import enChemistry from './resources/en/chemistry.json';
import koCommon from './resources/ko/common.json';
import koChemistry from './resources/ko/chemistry.json';

export type { Locale };
export { useTranslation } from 'react-i18next';

const resources = {
  en: {
    common: enCommon,
    chemistry: enChemistry,
  },
  ko: {
    common: koCommon,
    chemistry: koChemistry,
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
    ns: ['common', 'chemistry'],
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
