// Phase 11 §6.4 — MoleculeInfo docked 패널 (registerPanel.load default).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMoleculeStore, selectActiveMolecule } from '@/stores';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
import { OverviewTab } from './OverviewTab';
import { BondsTab } from './BondsTab';
import { StereoTab } from './StereoTab';

export default function MoleculeInfoPanel(): React.ReactElement {
  const { t } = useTranslation('panels');
  const active = useMoleculeStore(selectActiveMolecule);

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-muted">{t('moleculeInfo.empty.noActive')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header>
        <h2 className="break-all font-mono text-sm font-semibold text-fg-primary">
          {active.canonicalSmiles}
        </h2>
      </header>
      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="overview">{t('moleculeInfo.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="bonds">{t('moleculeInfo.tabs.bonds')}</TabsTrigger>
          <TabsTrigger value="stereo">{t('moleculeInfo.tabs.stereo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex-1 overflow-auto">
          <OverviewTab molecule={active} />
        </TabsContent>
        <TabsContent value="bonds" className="flex-1 overflow-auto">
          <BondsTab molecule={active} />
        </TabsContent>
        <TabsContent value="stereo" className="flex-1 overflow-auto">
          <StereoTab molecule={active} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
