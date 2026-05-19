// Phase 11 §4.2 / §6.5 / D-PRIMARY-CARD-FORMAT / D-MOLECULE-CARD-COPY —
// CompoundBrowser + ReactionResult 공유 카드. discriminated union (compound |
// molecule). 상단 분자식+분자량 / 중단 SMILES(mono+copy) / 하단 메타 /
// 우측 액션. clipboard 미지원 fallback 은 Phase 15.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Compound, Molecule } from '@/chemistry/compounds/types';
import { useUiStore } from '@/stores';
import { Button, IconButton } from '@/components';
import { Copy, Plus, X } from 'lucide-react';
import { deriveFormulaWeight } from './formula';
import { cn } from './cn';

export type MoleculeCardSource = 'compound' | 'reaction-product';

export interface MoleculeCardCommonProps {
  readonly actions?: {
    readonly onAddToWorkspace?: () => void;
    readonly onDismiss?: () => void;
  };
  readonly badge?: 'experimental' | null;
  readonly compact?: boolean;
}

export type MoleculeCardProps =
  | (MoleculeCardCommonProps & { readonly compound: Compound; readonly molecule?: never })
  | (MoleculeCardCommonProps & {
      readonly molecule: Molecule;
      readonly compound?: never;
      readonly source?: MoleculeCardSource;
    });

export function MoleculeCard(props: MoleculeCardProps): React.ReactElement {
  const { t, i18n } = useTranslation('panels');
  const notify = useUiStore((s) => s.actions.notify);
  const { actions, badge, compact } = props;

  let formula: string;
  let weight: number;
  let smiles: string;
  let title: string;
  let category: string | null = null;
  let extra: string | null; // 양 분기 모두 대입 (definite assignment)

  if ('compound' in props && props.compound) {
    const c = props.compound;
    formula = c.molecularFormula;
    weight = c.molecularWeight;
    smiles = c.smiles;
    title = (i18n.language === 'ko' ? (c.name.ko ?? c.name.en) : c.name.en) || c.molecularFormula;
    category = c.category;
    const mp = c.properties.meltingPointK;
    const bp = c.properties.boilingPointK;
    extra =
      [
        mp != null ? `mp ${mp.toFixed(0)} K` : null,
        bp != null ? `bp ${bp.toFixed(0)} K` : null,
        c.properties.waterSolubility !== 'unknown' ? c.properties.waterSolubility : null,
      ]
        .filter(Boolean)
        .join(' · ') || null;
  } else {
    // discriminated union + `never` 좁히기 한계 → 명시 캐스트 (런타임 보장:
    // compound 없으면 molecule variant).
    const m = props.molecule as Molecule;
    const d = deriveFormulaWeight(m);
    formula = d.formula;
    weight = d.weight;
    smiles = m.canonicalSmiles;
    title = d.formula;
    extra = m.totalCharge !== 0 ? `charge ${m.totalCharge > 0 ? '+' : ''}${m.totalCharge}` : null;
  }

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(smiles);
      notify({ level: 'success', messageKey: 'panels:moleculeInfo.copied' });
    } catch {
      notify({ level: 'error', messageKey: 'panels:moleculeInfo.copyFailed' });
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border bg-bg-panel p-3',
        compact && 'gap-1 p-2',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg-primary">{title}</p>
          <p className="text-xs text-fg-muted">
            {formula} · {weight.toFixed(2)} g/mol
          </p>
        </div>
        {badge === 'experimental' && (
          <span className="shrink-0 rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-medium text-warn">
            {t('reactionResult.title')}*
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded bg-bg-panel-elevated px-2 py-1 font-mono text-xs text-fg-primary">
            {smiles}
          </code>
          <IconButton
            size="sm"
            aria-label={t('moleculeInfo.fields.smiles')}
            onClick={() => void onCopy()}
          >
            <Copy size={14} />
          </IconButton>
        </div>
      )}

      {(category || extra) && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
          {category && (
            <span className="rounded bg-bg-panel-elevated px-1.5 py-0.5">{category}</span>
          )}
          {extra && <span>{extra}</span>}
        </div>
      )}

      {(actions?.onAddToWorkspace || actions?.onDismiss) && (
        <div className="flex justify-end gap-2">
          {actions.onDismiss && (
            <Button size="sm" variant="ghost" onClick={actions.onDismiss}>
              <X size={14} />
            </Button>
          )}
          {actions.onAddToWorkspace && (
            <Button size="sm" variant="secondary" onClick={actions.onAddToWorkspace}>
              <Plus size={14} />
              {t('compoundBrowser.addToWorkspace')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
