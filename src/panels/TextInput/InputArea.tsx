// Phase 12 §2.1 / §6.1 / D-INPUT-WIDGET / D-ENTER-SUBMIT — Input(single-line) / textarea(InChI) 분기.
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components';
import type { TextInputMode } from './types';

interface Props {
  readonly mode: TextInputMode;
  readonly raw: string;
  readonly onChange: (s: string) => void;
  readonly onEnterSubmit?: (() => void) | undefined;
}

export function InputArea({ mode, raw, onChange, onEnterSubmit }: Props) {
  const { t } = useTranslation('panels');
  const placeholder = t(`textInput.placeholder.${mode}`);
  const ariaLabel = t(`textInput.modeTabs.${mode}`);

  if (mode === 'inchi') {
    return (
      <textarea
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-md border border-border bg-bg-panel px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && onEnterSubmit) {
      e.preventDefault();
      onEnterSubmit();
    }
  };

  return (
    <Input
      aria-label={ariaLabel}
      autoComplete="off"
      spellCheck={false}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      value={raw}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  );
}
