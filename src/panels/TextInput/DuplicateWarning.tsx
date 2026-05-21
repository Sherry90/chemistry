// Phase 12 §2.1 (line 59-63) / §6.6 — InChIKey 매칭 시 amber 카드 + "기존 분자 활성화" 액션.
import { useTranslation } from 'react-i18next';
import { useUiStore, useMoleculeStore } from '@/stores';
import type { MoleculeId } from '@/stores';
import { Button } from '@/components';

interface Props {
  readonly existingId: MoleculeId;
}

export function DuplicateWarning({ existingId }: Props) {
  const { t } = useTranslation('panels');
  const setActive = useMoleculeStore((s) => s.actions.setActive);
  const toggleTextInput = useUiStore((s) => s.actions.toggleTextInput);

  const onActivate = (): void => {
    setActive(existingId);
    toggleTextInput(false);
  };

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md bg-warn/10 p-3 ring-1 ring-warn/30"
    >
      <p className="text-sm text-fg-primary">{t('textInput.duplicate.message')}</p>
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={onActivate}>
          {t('textInput.duplicate.activateExisting')}
        </Button>
      </div>
    </div>
  );
}
