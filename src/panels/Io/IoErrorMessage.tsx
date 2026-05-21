// Phase 13 §6.8 — IoErrorMessage. ExportError | ImportError → mapIoErrorToKey + 메시지 + action 버튼.
// i18n: mapped.key 는 'common.io.error.{export,import}.*' (절대 경로) → 'common.' prefix 제거 + ns='common'.
// 액션 라벨은 panels.io.error.* (ns='panels').
import { useTranslation } from 'react-i18next';
import { mapIoErrorToKey } from '@/stores';
import type { ExportError, ImportError } from '@/io';
import { Button } from '@/components';
import { AlertCircle, RefreshCw, Upload, RotateCcw } from 'lucide-react';

interface Props {
  readonly error: ExportError | ImportError;
  readonly context: 'export' | 'import';
  readonly onRetry?: () => void;
  readonly onPickFileAgain?: () => void;
}

export function IoErrorMessage({ error, context, onRetry, onPickFileAgain }: Props) {
  const { t: tCommon } = useTranslation('common');
  const { t: tPanels } = useTranslation('panels');
  const mapped = mapIoErrorToKey(error, context);

  // mapped.key 는 'common.io.error.*' (절대 경로) — 'common.' prefix 제거 후
  // ns='common' 의 nested key (io.error.*) 로 해소.
  const messageKey = mapped.key.replace(/^common\./, '');
  const message = mapped.params ? tCommon(messageKey, mapped.params) : tCommon(messageKey);

  const onAction = (): void => {
    switch (mapped.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'pick-file-again':
        onPickFileAgain?.();
        break;
      case 'reload-page':
        window.location.reload();
        break;
      case null:
      case undefined:
      default:
        break;
    }
  };

  const hasButton =
    mapped.action === 'retry' ||
    mapped.action === 'pick-file-again' ||
    mapped.action === 'reload-page';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-2 rounded-md bg-error/10 p-3 ring-1 ring-error/30"
    >
      <div className="flex items-start gap-2">
        <AlertCircle aria-hidden size={16} className="mt-0.5 text-error flex-shrink-0" />
        <p className="text-sm text-fg-primary">{message}</p>
      </div>
      {hasButton && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {mapped.action === 'retry' && (
              <>
                <RotateCcw size={14} className="mr-1" />
                {tPanels('io.error.retry')}
              </>
            )}
            {mapped.action === 'pick-file-again' && (
              <>
                <Upload size={14} className="mr-1" />
                {tPanels('io.error.pickFileAgain')}
              </>
            )}
            {mapped.action === 'reload-page' && (
              <>
                <RefreshCw size={14} className="mr-1" />
                {tPanels('io.error.reloadPage')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
