// Phase 13 §6.4 — JsonExportPane. scope (active|all) Tabs + 포함/제외 안내 + Export.
// exportJson 은 sync (JSON.stringify) — Promise 불요.
import type * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
import { exportJson, triggerDownload } from '@/io';
import type { ExportError } from '@/io';
import {
  useMoleculeStore,
  useUiStore,
  selectActiveMolecule,
  selectAllMoleculeSnapshots,
} from '@/stores';
import { IoErrorMessage } from './IoErrorMessage';

type Scope = 'active' | 'all';

interface Props {
  readonly onClose: () => void;
}

export function JsonExportPane({ onClose }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const active = useMoleculeStore(selectActiveMolecule);
  const snapshots = useMoleculeStore(selectAllMoleculeSnapshots);
  const notify = useUiStore((s) => s.actions.notify);
  const activeDisabled = active == null;
  const [scope, setScope] = useState<Scope>(activeDisabled ? 'all' : 'active');
  const [error, setError] = useState<ExportError | null>(null);

  const count = scope === 'active' ? (active ? 1 : 0) : snapshots.length;

  const onExport = (): void => {
    setError(null);
    const result = exportJson({ scope });
    if (result.ok) {
      triggerDownload(result.value.blob, result.value.filename);
      notify({
        level: 'success',
        messageKey: 'panels:io.jsonExport.success',
        dismissAfterMs: 2500,
      });
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList>
          <TabsTrigger value="active" disabled={activeDisabled}>
            {t('io.jsonExport.scope.active')}
          </TabsTrigger>
          <TabsTrigger value="all">{t('io.jsonExport.scope.all')}</TabsTrigger>
        </TabsList>
        <TabsContent value="active" />
        <TabsContent value="all" />
      </Tabs>
      <div className="flex flex-col gap-1 rounded-md border border-border bg-bg-panel-elevated p-3 text-sm">
        <p className="font-medium text-fg-primary">{t('io.jsonExport.includes')}</p>
        <p className="text-fg-muted">{t('io.jsonExport.includesItems', { count })}</p>
        <p className="text-fg-muted">{t('io.jsonExport.excludes')}</p>
      </div>
      {error && (
        <IoErrorMessage
          error={error}
          context="export"
          onRetry={() => {
            setError(null);
            onExport();
          }}
        />
      )}
      <div className="flex justify-end pt-2">
        <Button variant="primary" data-testid="io-json-export-submit" onClick={onExport}>
          {t('io.jsonExport.exportButton')}
        </Button>
      </div>
    </div>
  );
}
