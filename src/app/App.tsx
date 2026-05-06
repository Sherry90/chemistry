import { useTranslation } from 'react-i18next';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';

export function App() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h1 className="text-xl font-semibold">{t('app.title')}</h1>
        <div className="flex gap-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>
      <main role="main" className="p-6">
        {/* TODO: Phase 08+ — Viewport */}
        {/* TODO: Phase 11  — Panels */}
      </main>
    </div>
  );
}
