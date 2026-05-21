// Phase 11 §6.6 — Undo/Redo/CreateBond/SMILES. undo 토스트는 ToolbarBar 의
// useUndoSelectionToast 단일 관찰자 (버튼 직접 발화 안 함, Cmd+Z 일관).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import type { ViewportApi } from '@/viewport';
import { useMoleculeStore, useUiStore, useUndoStack } from '@/stores';
import { KEY_MAP, describeKey } from '@/viewport';
import { IconButton, Tooltip } from '@/components';
import { Undo2, Redo2, Link2, Plus } from 'lucide-react';

interface Props {
  readonly apiRef: RefObject<ViewportApi | null>;
}

const hint = (t: (k: string) => string, label: string, id: string): string => {
  const b = KEY_MAP.find((x) => x.id === id);
  return b ? `${t(label)} (${describeKey(b)})` : t(label);
};

export function EditGroup({ apiRef }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const { canUndo, canRedo } = useUndoStack();
  const undo = useMoleculeStore((s) => s.actions.undo);
  const redo = useMoleculeStore((s) => s.actions.redo);
  const notify = useUiStore((s) => s.actions.notify);
  const toggleTextInput = useUiStore((s) => s.actions.toggleTextInput);

  const onCreateBond = (): void => {
    const ok = apiRef.current?.createBondFromSelection() ?? false;
    if (!ok) {
      notify({
        level: 'warn',
        messageKey: 'shortcuts.bondCreate.diffMolecule',
        dismissAfterMs: 4000,
      });
    }
  };

  const onSmiles = (): void => {
    toggleTextInput(true);
  };

  return (
    <>
      <Tooltip content={hint(t, 'toolbar.undo', 'undo')}>
        <IconButton aria-label={t('toolbar.undo')} disabled={!canUndo} onClick={() => undo()}>
          <Undo2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={hint(t, 'toolbar.redo', 'redo')}>
        <IconButton aria-label={t('toolbar.redo')} disabled={!canRedo} onClick={() => redo()}>
          <Redo2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={hint(t, 'toolbar.createBond', 'createBondFromSelection')}>
        <IconButton aria-label={t('toolbar.createBond')} onClick={onCreateBond}>
          <Link2 size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('toolbar.smilesInput')}>
        <IconButton aria-label={t('toolbar.smilesInput')} onClick={onSmiles}>
          <Plus size={18} />
        </IconButton>
      </Tooltip>
    </>
  );
}
