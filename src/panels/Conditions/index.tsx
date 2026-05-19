// Phase 11 §6.3 / D-CONDITIONS-UNITS / D-REACTION-RUN / D-REACTION-RESULT-AUTO-OPEN
// — docked 사이드패널. 슬라이더(표시 단위 변환) + 반응물 선택 + 실행 단일 진입점.
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactionStore,
  selectCondition,
  selectReactantIds,
  selectIsRunning,
  mapReactionErrorToKey,
  useMoleculeStore,
  selectMoleculeIds,
  useUiStore,
  useSettingsStore,
  selectUnits,
} from '@/stores';
import { Slider, Label, Switch, Button, Separator } from '@/components';
import { kelvinToCelsius, celsiusToKelvin, atmToPa, paToAtm, rangesFor } from './units';

const first = (v: readonly number[]): number | undefined => v[0];

export default function ConditionsPanel(): React.ReactElement {
  const { t } = useTranslation('panels');
  const condition = useReactionStore(selectCondition);
  const patchCondition = useReactionStore((s) => s.actions.patchCondition);
  const reactantIds = useReactionStore(selectReactantIds);
  const isRunning = useReactionStore(selectIsRunning);
  const addReactant = useReactionStore((s) => s.actions.addReactant);
  const removeReactant = useReactionStore((s) => s.actions.removeReactant);
  const run = useReactionStore((s) => s.actions.run);
  const ids = useMoleculeStore(selectMoleculeIds);
  const molecules = useMoleculeStore((s) => s.molecules);
  const toggleReactionResult = useUiStore((s) => s.actions.toggleReactionResult);
  const notify = useUiStore((s) => s.actions.notify);
  const units = useSettingsStore(selectUnits);
  const ranges = rangesFor(units);

  const tempDisplay =
    units.temperature === 'K' ? condition.temperatureK : kelvinToCelsius(condition.temperatureK);
  const pressureDisplay =
    units.pressure === 'atm' ? condition.pressureAtm : atmToPa(condition.pressureAtm);

  const onRun = async (): Promise<void> => {
    await run();
    const rs = useReactionStore.getState().run;
    if (rs.kind === 'success') {
      toggleReactionResult(true); // D-REACTION-RESULT-AUTO-OPEN
    } else if (rs.kind === 'error') {
      notify({ level: 'error', messageKey: mapReactionErrorToKey(rs.error) });
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg-primary">{t('conditions.title')}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => patchCondition({ temperatureK: 298.15, pressureAtm: 1, pH: null })}
        >
          {t('conditions.resetToDefaults')}
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temp-slider">{t('conditions.temperatureLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {tempDisplay.toFixed(1)}{' '}
            {units.temperature === 'K'
              ? t('conditions.tempUnit.kelvin')
              : t('conditions.tempUnit.celsius')}
          </span>
        </div>
        <Slider
          id="temp-slider"
          min={ranges.temperature.min}
          max={ranges.temperature.max}
          step={ranges.temperature.step}
          value={[tempDisplay]}
          onValueChange={(vals) => {
            const v = first(vals);
            if (v == null) return;
            patchCondition({ temperatureK: units.temperature === 'K' ? v : celsiusToKelvin(v) });
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pressure-slider">{t('conditions.pressureLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {pressureDisplay.toFixed(2)}{' '}
            {units.pressure === 'atm'
              ? t('conditions.pressureUnit.atm')
              : t('conditions.pressureUnit.pa')}
          </span>
        </div>
        <Slider
          id="pressure-slider"
          min={ranges.pressure.min}
          max={ranges.pressure.max}
          step={ranges.pressure.step}
          value={[pressureDisplay]}
          onValueChange={(vals) => {
            const v = first(vals);
            if (v == null) return;
            patchCondition({ pressureAtm: units.pressure === 'atm' ? v : paToAtm(v) });
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ph-slider">{t('conditions.phLabel')}</Label>
          <span className="text-sm text-fg-muted">
            {condition.pH == null ? t('conditions.phDisabled') : condition.pH}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={condition.pH != null}
            onCheckedChange={(checked) => patchCondition({ pH: checked ? 7 : null })}
            aria-label={t('conditions.phLabel')}
          />
          <Slider
            id="ph-slider"
            min={0}
            max={14}
            step={1}
            value={[condition.pH ?? 7]}
            disabled={condition.pH == null}
            onValueChange={(vals) => {
              const v = first(vals);
              if (v != null) patchCondition({ pH: Math.round(v) });
            }}
            className="flex-1"
          />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-fg-primary">{t('conditions.reactants')}</h3>
        {ids.length === 0 ? (
          <p className="text-xs text-fg-muted">{t('conditions.noReactants')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ids.map((id) => {
              const checked = reactantIds.includes(id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-2 text-sm text-fg-primary">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => (checked ? removeReactant(id) : addReactant(id))}
                    />
                    <span className="truncate font-mono text-xs">
                      {molecules[id]?.canonicalSmiles ?? id}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={reactantIds.length === 0 || isRunning}
          onClick={() => void onRun()}
        >
          {t('conditions.runReaction')}
        </Button>
      </section>
    </div>
  );
}
