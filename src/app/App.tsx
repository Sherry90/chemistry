// Phase 10 §12.1 retrofit — Phase 01 <AppShell> placeholder → <AppLayout/>.
// Toolbar 슬롯에 Phase 01 title + 토글을 임시 주입 (Phase 11 <ToolbarBar/> 가
// 교체 — toolbar prop 이 그 주입 지점).
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/app/layout';
import { LocaleToggle } from '@/components/LocaleToggle';
import { ThemeToggle } from '@/components/ThemeToggle';

export function App() {
  const { t } = useTranslation('common');
  return (
    <AppLayout
      toolbar={
        <>
          <h1 className="text-base font-semibold text-fg-primary">{t('app.title')}</h1>
          <div className="ml-auto flex gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </>
      }
    />
  );
}
