// Phase 11 §6.5 — ThermoFlag 아이콘+라벨 + confidence band+dot.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactionResult } from '@/chemistry/reactions/types';
import { Flame, Snowflake, HelpCircle } from 'lucide-react';
import { cn } from '../_shared/cn';

const THERMO_ICON = {
  exothermic: Flame,
  endothermic: Snowflake,
  unknown: HelpCircle,
} as const;

function band(c: number): 'high' | 'medium' | 'low' {
  return c >= 0.66 ? 'high' : c >= 0.33 ? 'medium' : 'low';
}
const BAND_DOT = { high: 'bg-success', medium: 'bg-warn', low: 'bg-error' } as const;

export function ThermoTab({ result }: { readonly result: ReactionResult }): React.ReactElement {
  const { t } = useTranslation('panels');
  const Icon = THERMO_ICON[result.thermo];
  const b = band(result.confidence);

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <div className="flex items-center gap-2 text-fg-primary">
        <Icon size={18} aria-hidden />
        <span>{t(`reactionResult.thermo.${result.thermo}`)}</span>
      </div>
      <div className="flex items-center gap-2 text-fg-muted">
        <span className={cn('inline-block h-2 w-2 rounded-full', BAND_DOT[b])} aria-hidden />
        <span>{t(`reactionResult.confidence.${b}`)}</span>
        <span className="text-xs">({(result.confidence * 100).toFixed(0)}%)</span>
      </div>
      {result.notes && <p className="text-xs text-fg-muted">{t(result.notes, { ns: 'common' })}</p>}
    </div>
  );
}
