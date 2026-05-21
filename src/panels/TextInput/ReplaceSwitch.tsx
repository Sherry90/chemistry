// Phase 12 §2.1 (line 48) / D-LOAD-SEMANTICS — 활성 분자 교체 토글 + 도움말 툴팁.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Switch, Tooltip } from '@/components';

interface Props {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (c: boolean) => void;
}

export function ReplaceSwitch({ checked, disabled, onChange }: Props) {
  const { t } = useTranslation('panels');
  const id = useId();
  const label = t('textInput.replaceToggle.label');
  const tooltipContent = disabled
    ? t('textInput.replaceToggle.disabledNoActive')
    : checked
      ? t('textInput.replaceToggle.helpReplace')
      : t('textInput.replaceToggle.helpAdd');

  return (
    <div className="flex items-center gap-2">
      <Tooltip content={tooltipContent}>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
          aria-label={label}
        />
      </Tooltip>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
    </div>
  );
}
