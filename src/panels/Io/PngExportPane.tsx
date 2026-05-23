// Phase 13 §6.3 — PngExportPane. format (png/jpeg/webp) × DPR (1/2/3/4) × transparent.
// JPEG 선택 시 transparentBackground disabled + Tooltip 안내. D-PNG-CLOSE-AFTER: 성공 시 모달 닫기.
import type * as React from 'react';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Label, Tabs, TabsList, TabsTrigger, Tooltip, Spinner } from '@/components';
import { exportPng, triggerDownload, DEFAULT_PNG_OPTIONS } from '@/io';
import type { PngExportOptions, ExportError } from '@/io';
import { useUiStore } from '@/stores';
import type { ViewportApi } from '@/viewport';
import { IoErrorMessage } from './IoErrorMessage';

interface Props {
  readonly apiRef: RefObject<ViewportApi | null>;
  readonly onClose: () => void;
}

export function PngExportPane({ apiRef, onClose }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const [options, setOptions] = useState<PngExportOptions>(DEFAULT_PNG_OPTIONS);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<ExportError | null>(null);
  const notify = useUiStore((s) => s.actions.notify);

  const transparentDisabled = options.format === 'jpeg';

  const onExport = async (): Promise<void> => {
    setExporting(true);
    setError(null);
    const result = await exportPng({ apiRef, options });
    setExporting(false);
    if (result.ok) {
      triggerDownload(result.value.blob, result.value.filename);
      notify({
        level: 'success',
        messageKey: 'panels:io.pngExport.success',
        dismissAfterMs: 2500,
      });
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Label>{t('io.pngExport.format.label')}</Label>
        <Tabs
          value={options.format}
          onValueChange={(v) =>
            setOptions((o) => ({ ...o, format: v as PngExportOptions['format'] }))
          }
        >
          <TabsList>
            <TabsTrigger value="png">{t('io.pngExport.format.png')}</TabsTrigger>
            <TabsTrigger value="jpeg">{t('io.pngExport.format.jpeg')}</TabsTrigger>
            <TabsTrigger value="webp">{t('io.pngExport.format.webp')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-3">
        <Label>{t('io.pngExport.dpr.label')}</Label>
        <Tabs
          value={String(options.dpr)}
          onValueChange={(v) => setOptions((o) => ({ ...o, dpr: Number(v) }))}
        >
          <TabsList>
            <TabsTrigger value="1">{t('io.pngExport.dpr.1x')}</TabsTrigger>
            <TabsTrigger value="2">{t('io.pngExport.dpr.2x')}</TabsTrigger>
            <TabsTrigger value="3">{t('io.pngExport.dpr.3x')}</TabsTrigger>
            <TabsTrigger value="4">{t('io.pngExport.dpr.4x')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-3">
        {transparentDisabled ? (
          <Tooltip content={t('io.pngExport.transparent.disabledHint')}>
            <div className="flex items-center gap-2">
              <Switch checked={false} disabled aria-label={t('io.pngExport.transparent.label')} />
              <Label>{t('io.pngExport.transparent.label')}</Label>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2">
            <Switch
              checked={options.transparentBackground}
              onCheckedChange={(checked) =>
                setOptions((o) => ({ ...o, transparentBackground: checked }))
              }
              aria-label={t('io.pngExport.transparent.label')}
            />
            <Label>{t('io.pngExport.transparent.label')}</Label>
          </div>
        )}
      </div>
      {error && (
        <IoErrorMessage
          error={error}
          context="export"
          onRetry={() => {
            setError(null);
            void onExport();
          }}
        />
      )}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          data-testid="io-png-export-submit"
          disabled={exporting}
          onClick={() => void onExport()}
        >
          {exporting && <Spinner size="sm" className="mr-2" />}
          {t('io.pngExport.exportButton')}
        </Button>
      </div>
    </div>
  );
}
