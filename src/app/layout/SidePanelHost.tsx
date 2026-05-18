// Phase 10 §6.2 — active(docked) 패널 lazy 마운트. 훅은 조건 분기 전 모두 호출
// (rules-of-hooks — 문서 §6.2 의사코드의 early-return 후 useMemo 는 수정).
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectActivePanel } from '@/stores';
import { usePanelDefinition, lazyPanelComponent } from './panels/PanelRegistry';
import { LoadingOverlay } from './LoadingOverlay';

function EmptySidepanel() {
  const { t } = useTranslation('common');
  return (
    <aside className="flex h-full items-center justify-center border-l border-border bg-bg-panel">
      <p className="text-sm text-fg-muted">{t('panels.empty.hint')}</p>
    </aside>
  );
}

export function SidePanelHost() {
  const activeKey = useUiStore(selectActivePanel);
  const definition = usePanelDefinition(activeKey);
  const { t } = useTranslation('common');

  const docked = definition && definition.mode === 'docked' ? definition : null;
  if (!docked) return <EmptySidepanel />;
  const LazyPanel = lazyPanelComponent(docked); // key 단위 캐시 (모듈 레벨)

  return (
    <aside className="flex h-full flex-col border-l border-border bg-bg-panel">
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-medium text-fg-primary">{t(docked.i18nTitleKey)}</h2>
      </header>
      <div className="relative flex-1 overflow-auto">
        <Suspense fallback={<LoadingOverlay variant="panel" visible />}>
          <LazyPanel />
        </Suspense>
      </div>
    </aside>
  );
}
