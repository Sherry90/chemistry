import { useLocale } from '@/hooks/useLocale';
import { useTranslation } from 'react-i18next';

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation('common');

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
      className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
      aria-label={locale === 'ko' ? t('locale.en') : t('locale.ko')}
    >
      {locale === 'ko' ? t('locale.en') : t('locale.ko')}
    </button>
  );
}
