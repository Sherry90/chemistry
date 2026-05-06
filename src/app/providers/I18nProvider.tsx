import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { Locale } from '@/types/settings';
import { initI18n, setLocale, i18n } from '@/i18n';
import { LocaleContext } from '@/hooks/useLocale';

const STORAGE_KEY = 'chem.locale';

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ko' || stored === 'en') return stored;
  const lang = navigator.language.split('-')[0];
  if (lang === 'ko') return 'ko';
  return 'en';
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const [ready, setReady] = useState(false);
  const initialLocaleRef = useRef(locale);

  useEffect(() => {
    void initI18n(initialLocaleRef.current).then(() => setReady(true));
  }, []);

  const handleSetLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
    void setLocale(l);
  };

  if (!ready) return null;

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}
