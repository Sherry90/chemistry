// Phase 11 §6.5 / D-EXPERIMENTAL-BADGE-PLACEMENT — experimental 배지.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components';
import { FlaskConical } from 'lucide-react';

export function ExperimentalBadge(): React.ReactElement {
  const { t } = useTranslation('common');
  return (
    <Tooltip content={t('reaction.experimentalDisclaimer')}>
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn ring-1 ring-warn/30">
        <FlaskConical aria-hidden size={12} />
        {t('reaction.experimentalBadge')}
        <span aria-hidden>*</span>
      </span>
    </Tooltip>
  );
}
