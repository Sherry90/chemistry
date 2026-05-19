// Phase 11 §6.4 — overview: SMILES(copy)/InChI/formula/MW/charge/spin.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Molecule } from '@/chemistry/compounds/types';
import { useUiStore } from '@/stores';
import { IconButton } from '@/components';
import { Copy } from 'lucide-react';
import { deriveFormulaWeight } from '../_shared/formula';

export function OverviewTab({ molecule }: { readonly molecule: Molecule }): React.ReactElement {
  const { t } = useTranslation('panels');
  const notify = useUiStore((s) => s.actions.notify);
  const { formula, weight } = deriveFormulaWeight(molecule);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(molecule.canonicalSmiles);
      notify({ level: 'success', messageKey: 'panels:moleculeInfo.copied' });
    } catch {
      notify({ level: 'error', messageKey: 'panels:moleculeInfo.copyFailed' });
    }
  };

  const F = 'moleculeInfo.fields';
  return (
    <dl className="flex flex-col gap-2 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-fg-muted">{t(`${F}.smiles`)}</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <code className="truncate font-mono text-xs text-fg-primary">
            {molecule.canonicalSmiles}
          </code>
          <IconButton size="sm" aria-label={t(`${F}.smiles`)} onClick={() => void copy()}>
            <Copy size={14} />
          </IconButton>
        </dd>
      </div>
      {molecule.inchi && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-fg-muted">{t(`${F}.inchi`)}</dt>
          <dd className="break-all font-mono text-xs text-fg-primary">{molecule.inchi}</dd>
        </div>
      )}
      <Row label={t(`${F}.molecularFormula`)} value={formula} />
      <Row label={t(`${F}.molecularWeight`)} value={`${weight.toFixed(2)} g/mol`} />
      <Row label={t(`${F}.totalCharge`)} value={String(molecule.totalCharge)} />
      <Row label={t(`${F}.spinMultiplicity`)} value={String(molecule.spinMultiplicity)} />
    </dl>
  );
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg-primary">{value}</dd>
    </div>
  );
}
