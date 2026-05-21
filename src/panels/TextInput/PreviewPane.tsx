// Phase 12 §6.4 — AsyncState 4 분기 (idle / loading / error / success) 표시. success 시 MoleculeCard + duplicate.
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components';
import { MoleculeCard } from '@/panels/_shared/MoleculeCard';
import { ErrorMessage } from './ErrorMessage';
import { DuplicateWarning } from './DuplicateWarning';
import type { PreviewState } from './types';
import type { DuplicateInfo } from './useDuplicateCheck';

interface Props {
  readonly preview: PreviewState;
  readonly duplicate: DuplicateInfo;
}

export function PreviewPane({ preview, duplicate }: Props) {
  const { t } = useTranslation('panels');

  if (preview.kind === 'idle') {
    return <p className="text-sm text-fg-muted text-center py-8">{t('textInput.preview.empty')}</p>;
  }

  if (preview.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8" aria-live="polite">
        <Spinner size="md" />
        <p className="text-sm text-fg-muted">{t('textInput.preview.loading')}</p>
      </div>
    );
  }

  if (preview.kind === 'error') {
    return <ErrorMessage error={preview.error} />;
  }

  // success
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <MoleculeCard molecule={preview.value} source="text-input" />
      {duplicate.exists && duplicate.existingId !== null && (
        <DuplicateWarning existingId={duplicate.existingId} />
      )}
    </div>
  );
}
