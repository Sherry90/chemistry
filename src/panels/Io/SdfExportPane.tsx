// Phase 13 §6.5 — SdfExportPane. JsonExportPane 패턴 정합 (scope Tabs + Export 버튼).
// D6: multi-record 단일 .sdf (RFC `$$$$\n` separator). exportSdf 는 sync.
import type * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tabs, TabsList, TabsTrigger } from '@/components';
import { exportSdf, triggerDownload } from '@/io';
import type { ExportError } from '@/io';
import { useMoleculeStore, useUiStore, selectActiveMolecule } from '@/stores';
import { IoErrorMessage } from './IoErrorMessage';

type Scope = 'active' | 'all';

interface Props {
  readonly onClose: () => void;
}

export function SdfExportPane({ onClose }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const active = useMoleculeStore(selectActiveMolecule);
  const notify = useUiStore((s) => s.actions.notify);
  const activeDisabled = active == null;
  const [scope, setScope] = useState<Scope>(activeDisabled ? 'all' : 'active');
  const [error, setError] = useState<ExportError | null>(null);

  const onExport = (): void => {
    setError(null);
    const result = exportSdf({ scope });
    if (result.ok) {
      triggerDownload(result.value.blob, result.value.filename);
      notify({
        level: 'success',
        messageKey: 'panels:io.sdfExport.success',
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
            {t('io.sdfExport.scope.active')}
          </TabsTrigger>
          <TabsTrigger value="all">{t('io.sdfExport.scope.all')}</TabsTrigger>
        </TabsList>
      </Tabs>
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
        <Button variant="primary" onClick={onExport}>
          {t('io.sdfExport.exportButton')}
        </Button>
      </div>
    </div>
  );
}
