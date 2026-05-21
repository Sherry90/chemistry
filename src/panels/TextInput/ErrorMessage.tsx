// Phase 12 §6.5 — IngestError → mapIngestErrorToKey 호출 + 메시지 + action 버튼.
// i18n: mapped.key 는 'common.ingest.error.*' 절대 경로 → 'common.' prefix 제거 + ns='common'.
import { useTranslation } from 'react-i18next';
import { useUiStore, mapIngestErrorToKey } from '@/stores';
import type { IngestError } from '@/stores';
import { Button } from '@/components';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';

interface Props {
  readonly error: IngestError;
}

export function ErrorMessage({ error }: Props) {
  const { t: tCommon } = useTranslation('common');
  const { t: tPanels } = useTranslation('panels');
  const mapped = mapIngestErrorToKey(error);
  const toggleCompoundBrowser = useUiStore((s) => s.actions.toggleCompoundBrowser);
  const toggleTextInput = useUiStore((s) => s.actions.toggleTextInput);

  // mapped.key 는 'common.ingest.error.*' (절대 경로) — 'common.' prefix 제거 후
  // ns='common' 의 nested key (ingest.error.*) 로 해소.
  const messageKey = mapped.key.replace(/^common\./, '');
  const message = mapped.params ? tCommon(messageKey, mapped.params) : tCommon(messageKey);

  const onAction = (): void => {
    switch (mapped.action) {
      case 'open-compound-browser':
        toggleTextInput(false);
        toggleCompoundBrowser(true);
        break;
      case 'reload-page':
        window.location.reload();
        break;
      case 'activate-existing':
      case null:
      case undefined:
      default:
        // DuplicateWarning 으로 위임 — 본 분기에 도달하지 않음.
        break;
    }
  };

  const hasButton = mapped.action === 'open-compound-browser' || mapped.action === 'reload-page';

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
            {mapped.action === 'open-compound-browser' && (
              <>
                <Search size={14} className="mr-1" />
                {tPanels('textInput.formulaUnsupported.openCompoundBrowser')}
              </>
            )}
            {mapped.action === 'reload-page' && (
              <>
                <RefreshCw size={14} className="mr-1" />
                {tPanels('textInput.rdkitInitFailed.reloadPage')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
