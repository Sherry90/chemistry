import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';
import type { Theme } from '@/types/settings';

const CYCLE: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('common');

  const labels: Record<Theme, string> = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
  };

  return (
    <button
      type="button"
      onClick={() => setTheme(CYCLE[theme])}
      className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
      aria-label={labels[theme]}
    >
      {labels[theme]}
    </button>
  );
}
