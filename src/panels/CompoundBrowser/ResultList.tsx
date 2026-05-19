// Phase 11 §6.2 — 검색 결과 AsyncState 4 분기.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Compound } from '@/chemistry/compounds/types';
import { Spinner, Button } from '@/components';
import { MoleculeCard } from '../_shared/MoleculeCard';

export type ResultState = 'idle' | 'loading' | 'success' | 'error';

interface Props {
  readonly state: ResultState;
  readonly compounds: ReadonlyArray<Compound>;
  readonly errorKind?: string | undefined;
  readonly retryable?: boolean | undefined;
  readonly selectedCid: number | null;
  readonly onSelect: (cid: number) => void;
  readonly onRetry: () => void;
}

export function ResultList({
  state,
  compounds,
  errorKind,
  retryable,
  selectedCid,
  onSelect,
  onRetry,
}: Props): React.ReactElement {
  const { t } = useTranslation('panels');

  if (state === 'idle') {
    return <p className="p-4 text-sm text-fg-muted">{t('compoundBrowser.empty.idle')}</p>;
  }
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-error">
          {t('compoundBrowser.addFailed', { reason: errorKind ?? 'error' })}
        </p>
        {retryable && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t('reactionResult.retry')}
          </Button>
        )}
      </div>
    );
  }
  if (compounds.length === 0) {
    return <p className="p-4 text-sm text-fg-muted">{t('compoundBrowser.empty.noResults')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 overflow-auto">
      {compounds.map((c, i) => (
        <li key={c.cid ?? i}>
          <button
            type="button"
            onClick={() => {
              if (c.cid != null) onSelect(c.cid);
            }}
            aria-pressed={c.cid != null && c.cid === selectedCid}
            className="w-full text-left"
          >
            <MoleculeCard compound={c} compact />
          </button>
        </li>
      ))}
    </ul>
  );
}
