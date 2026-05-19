// Phase 11 §6.1 — 선택 원소 상세 (표시 전용 + "분자 시작" trigger).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Element } from '@/chemistry/elements';
import { useSettingsStore, selectLocale, selectUnits } from '@/stores';
import { Button } from '@/components';

interface Props {
  readonly element: Element;
  readonly onStartMolecule: () => void;
}

const fmt = (v: number | null, suffix = ''): string => (v == null ? '—' : `${v}${suffix}`);

export function ElementInfoSheet({ element, onStartMolecule }: Props): React.ReactElement {
  const { t } = useTranslation('panels');
  const locale = useSettingsStore(selectLocale);
  const units = useSettingsStore(selectUnits);
  const name = locale === 'ko' ? element.nameKo : element.nameEn;

  const temp = (k: number | null): string => {
    if (k == null) return '—';
    return units.temperature === 'C' ? `${(k - 273.15).toFixed(1)} °C` : `${k.toFixed(1)} K`;
  };

  const F = 'periodicTable.element.fields';
  const rows: ReadonlyArray<[string, string]> = [
    [t(`${F}.category`), element.category],
    [t(`${F}.block`), element.block],
    [t(`${F}.electronegativity`), fmt(element.electronegativity)],
    [t(`${F}.ionizationEnergy`), fmt(element.firstIonizationEnergyEV, ' eV')],
    [t(`${F}.covalentRadius`), fmt(element.covalentRadiusPm, ' pm')],
    [t(`${F}.vdwRadius`), fmt(element.vdwRadiusPm, ' pm')],
    [t(`${F}.meltingPoint`), temp(element.meltingPointK)],
    [t(`${F}.boilingPoint`), temp(element.boilingPointK)],
  ];

  return (
    <section className="flex flex-col gap-3" aria-label={name}>
      <header className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-fg-primary">{element.symbol}</span>
        <span className="text-sm text-fg-muted">
          {name} · Z={element.number} · {element.atomicMass.toFixed(3)}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-fg-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <Button size="sm" variant="secondary" onClick={onStartMolecule}>
          {t('periodicTable.element.startMolecule')}
        </Button>
      </div>
    </section>
  );
}
