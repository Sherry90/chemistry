// Phase 13 §6.6 — JsonImportPane. file picker + mode (replace|append) + Import.
// D7: replace 가 default. D-FILE-INPUT: native input. PartiallyFailed 는 ok=false 가 아니라
// applyImportedSession 의 result 형태에 따라 결정 — importJson 의 결과 분기에서 처리.
import type * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent, Spinner } from '@/components';
import { importJson } from '@/io';
import type { ImportError } from '@/io';
import { useUiStore } from '@/stores';
import { IoErrorMessage } from './IoErrorMessage';
import { ImportProgress } from './ImportProgress';

type ImportMode = 'replace' | 'append';

interface Props {
  readonly onClose: () => void;
}

export function JsonImportPane({ onClose }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<ImportError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notify = useUiStore((s) => s.actions.notify);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const onImport = async (): Promise<void> => {
    if (!file) return;
    setImporting(true);
    setError(null);
    const result = await importJson({ file, mode });
    setImporting(false);
    if (result.ok) {
      const { imported, skipped } = result.value;
      if (skipped > 0) {
        notify({
          level: 'warn',
          messageKey: 'panels:io.jsonImport.partial',
          messageParams: { imported, skipped },
          dismissAfterMs: 4000,
        });
      } else {
        notify({
          level: 'success',
          messageKey: 'panels:io.jsonImport.success',
          messageParams: { count: imported },
          dismissAfterMs: 2500,
        });
      }
      onClose();
    } else if (result.error.kind === 'PartiallyFailed') {
      notify({
        level: 'warn',
        messageKey: 'panels:io.jsonImport.partial',
        messageParams: { imported: result.error.imported, skipped: result.error.skipped },
        dismissAfterMs: 4000,
      });
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="relative flex flex-col gap-4 p-4">
      <ImportProgress visible={importing} />
      <div className="flex flex-col gap-2">
        <label htmlFor="io-import-file" className="text-sm text-fg-primary">
          {t('io.jsonImport.filePicker.label')}
        </label>
        <input
          id="io-import-file"
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onFileChange}
          aria-label={t('io.jsonImport.filePicker.label')}
          className="text-sm"
        />
        {!file && (
          <span className="text-xs text-fg-muted">{t('io.jsonImport.filePicker.noFile')}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-fg-primary">{t('io.jsonImport.mode.label')}</span>
        <Tabs value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
          <TabsList>
            <TabsTrigger value="replace">{t('io.jsonImport.mode.replace')}</TabsTrigger>
            <TabsTrigger value="append">{t('io.jsonImport.mode.append')}</TabsTrigger>
          </TabsList>
          <TabsContent value="replace" />
          <TabsContent value="append" />
        </Tabs>
      </div>
      {error && (
        <IoErrorMessage
          error={error}
          context="import"
          onPickFileAgain={() => {
            setError(null);
            setFile(null);
            fileInputRef.current?.click();
          }}
        />
      )}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          data-testid="io-import-submit"
          disabled={!file || importing}
          onClick={() => void onImport()}
        >
          {importing && <Spinner size="sm" className="mr-2" />}
          {t('io.jsonImport.importButton')}
        </Button>
      </div>
    </div>
  );
}
