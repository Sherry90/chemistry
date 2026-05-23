// Phase 12 §6.1 / §6.6 — TextInputDialog 본문 (default export). ModalHost 가 외부 Dialog 래퍼 + Title 렌더.
// 본 컴포넌트는 모달 내부 콘텐츠만 담당 (Tabs / InputArea / RdkitStatusInline / PreviewPane / ReplaceSwitch / footer).
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUiStore,
  useMoleculeStore,
  selectIsTextInputOpen,
  selectTextInputInitial,
  selectActiveMolecule,
} from '@/stores';
import { Button, DialogClose } from '@/components';
import { withRegeneratedIds } from '@/chemistry/compounds/regenerateIds';
import { ModeTabs } from './ModeTabs';
import { InputArea } from './InputArea';
import { PreviewPane } from './PreviewPane';
import { ReplaceSwitch } from './ReplaceSwitch';
import { RdkitStatusInline } from './RdkitStatusInline';
import { usePreviewParse } from './usePreviewParse';
import { useDuplicateCheck } from './useDuplicateCheck';
import type { TextInputMode } from './types';

export default function TextInputDialog(): React.ReactElement {
  const { t } = useTranslation('panels');
  const open = useUiStore(selectIsTextInputOpen);
  const initial = useUiStore(selectTextInputInitial);
  const toggle = useUiStore((s) => s.actions.toggleTextInput);
  const notify = useUiStore((s) => s.actions.notify);
  const active = useMoleculeStore(selectActiveMolecule);
  const addFromMolecule = useMoleculeStore((s) => s.actions.addFromMolecule);
  const replace = useMoleculeStore((s) => s.actions.replace);

  const [mode, setMode] = useState<TextInputMode>(initial?.kind ?? 'smiles');
  const [raw, setRaw] = useState<string>(initial?.raw ?? '');
  const [replaceOn, setReplaceOn] = useState<boolean>(false);

  // seed 인계 — initial / open 변경 시 mode + raw + replaceOn 초기화.
  useEffect(() => {
    if (initial) {
      setMode(initial.kind);
      setRaw(initial.raw);
    } else {
      setMode('smiles');
      setRaw('');
      setReplaceOn(false);
    }
  }, [initial, open]);

  const preview = usePreviewParse({ mode, raw, debounceMs: 300 });
  const duplicate = useDuplicateCheck(preview.kind === 'success' ? preview.value : null);

  const submitDisabled = preview.kind !== 'success' || (duplicate.exists && !replaceOn);

  const onSubmit = (): void => {
    if (preview.kind !== 'success') return;
    if (duplicate.exists && !replaceOn) return;
    const m = preview.value;
    if (replaceOn && active) {
      const regenerated = withRegeneratedIds(m, active.id);
      replace(active.id, regenerated);
      notify({
        level: 'success',
        messageKey: 'panels:textInput.submitted.replaced',
        dismissAfterMs: 2500,
      });
    } else {
      addFromMolecule(m);
      notify({
        level: 'success',
        messageKey: 'panels:textInput.submitted.added',
        dismissAfterMs: 2500,
      });
    }
    toggle(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <ModeTabs
          mode={mode}
          onChange={(m) => {
            setMode(m);
            setRaw('');
          }}
        />
        <InputArea
          mode={mode}
          raw={raw}
          onChange={setRaw}
          onEnterSubmit={mode !== 'inchi' ? onSubmit : undefined}
        />
        <RdkitStatusInline />
        <PreviewPane preview={preview} duplicate={duplicate} />
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <ReplaceSwitch checked={replaceOn} disabled={active == null} onChange={setReplaceOn} />
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="ghost">{t('textInput.action.cancel')}</Button>
          </DialogClose>
          <Button
            variant="primary"
            data-testid="textinput-submit"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {replaceOn ? t('textInput.action.replaceActive') : t('textInput.action.addToWorkspace')}
          </Button>
        </div>
      </footer>
    </div>
  );
}
