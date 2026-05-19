// Phase 11 §6.5 — rule-based=appliedRuleId 표시 / heuristic=disclaimer (CD5).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactionResult } from '@/chemistry/reactions/types';

export function RuleTab({ result }: { readonly result: ReactionResult }): React.ReactElement {
  const { t } = useTranslation('panels');
  const { t: tc } = useTranslation('common');

  if (result.kind === 'heuristic-experimental') {
    return <p className="p-4 text-sm text-fg-muted">{tc('reaction.experimentalDisclaimer')}</p>;
  }
  return (
    <p className="p-4 text-sm text-fg-primary">
      {t('reactionResult.rule.appliedRule', { id: result.appliedRuleId ?? '—' })}
    </p>
  );
}
