// Phase 11 §6.5 / D-REACTION-RESULT-CLEAR — ReactionResult 모달 (registerPanel
// .load default). AsyncState 4 분기. lastResult 보존 (close 시 clear 안 함).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactionStore,
  selectRunState,
  mapReactionErrorToKey,
  useMoleculeStore,
  useUiStore,
} from '@/stores';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, Spinner } from '@/components';
import { ProductsTab } from './ProductsTab';
import { RuleTab } from './RuleTab';
import { ThermoTab } from './ThermoTab';
import { ExperimentalBadge } from './ExperimentalBadge';

export default function ReactionResultPanel(): React.ReactElement {
  const { t } = useTranslation('panels');
  const run = useReactionStore(selectRunState);
  const runAction = useReactionStore((s) => s.actions.run);
  const addFromMolecule = useMoleculeStore((s) => s.actions.addFromMolecule);
  const addFromMolecules = useMoleculeStore((s) => s.actions.addFromMolecules);
  const notify = useUiStore((s) => s.actions.notify);

  if (run.kind === 'idle') {
    return <p className="p-6 text-sm text-fg-muted">{t('reactionResult.empty.idle')}</p>;
  }
  if (run.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <Spinner size="lg" />
        <p className="text-sm text-fg-muted">{t('reactionResult.running')}</p>
      </div>
    );
  }
  if (run.kind === 'error') {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-error">
          {t(mapReactionErrorToKey(run.error), { ns: 'common' })}
        </p>
        <Button variant="secondary" size="md" onClick={() => void runAction({ force: true })}>
          {t('reactionResult.retry')}
        </Button>
      </div>
    );
  }

  const result = run.value;
  const isExperimental = result.kind === 'heuristic-experimental';

  const onAddAll = (): void => {
    const ids = addFromMolecules(result.products);
    notify({
      level: 'success',
      messageKey: 'panels:reactionResult.addedProducts',
      messageParams: { count: ids.length },
      dismissAfterMs: 3000,
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-fg-primary">{t('reactionResult.title')}</h2>
          {isExperimental && <ExperimentalBadge />}
        </div>
        <Button variant="primary" size="md" onClick={onAddAll}>
          {t('reactionResult.addProductsToWorkspace')}
        </Button>
      </header>
      <Tabs defaultValue="products" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="products">{t('reactionResult.tabs.products')}</TabsTrigger>
          <TabsTrigger value="rule">{t('reactionResult.tabs.rule')}</TabsTrigger>
          <TabsTrigger value="thermo">{t('reactionResult.tabs.thermo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="flex-1 overflow-auto">
          <ProductsTab
            products={result.products}
            isExperimental={isExperimental}
            onAddOne={(m) => {
              addFromMolecule(m);
              notify({
                level: 'success',
                messageKey: 'panels:compoundBrowser.addedToWorkspace',
                dismissAfterMs: 2000,
              });
            }}
          />
        </TabsContent>
        <TabsContent value="rule" className="flex-1 overflow-auto">
          <RuleTab result={result} />
        </TabsContent>
        <TabsContent value="thermo" className="flex-1 overflow-auto">
          <ThermoTab result={result} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
