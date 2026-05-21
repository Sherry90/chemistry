// Phase 12 §6.10 / §7.2 / §7.3 / D-RDKIT-STATUS-IMPORT — RDKit loading 진행 인디케이터.
// panels/TextInput 만 @/engine/rdkit/status 직접 import 허용 (P1 명시 예외, read-only 구독).
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components';
import { onRdkitStatusChange, getRdkitStatus } from '@/engine/rdkit/status';
import type { RdkitStatus } from '@/engine/rdkit/status';

function getSnapshot(): RdkitStatus {
  return getRdkitStatus();
}

function subscribe(notify: () => void): () => void {
  return onRdkitStatusChange(() => notify());
}

function useRdkitStatus(): RdkitStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function RdkitStatusInline() {
  const { t } = useTranslation('panels');
  const status = useRdkitStatus();

  if (status.phase !== 'loading') return null;

  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted" aria-live="polite">
      <Spinner size="sm" />
      <span>{t('textInput.rdkitLoading')}</span>
      {status.progress !== undefined && (
        <span className="ml-1">{Math.round(status.progress * 100)}%</span>
      )}
    </div>
  );
}
