// Phase 11 §6.4 — 결합 길이/각 표 (selectBondMetrics standalone 순수 + WeakMap).
import type * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Molecule } from '@/chemistry/compounds/types';
import { selectBondMetrics } from '@/stores';

export function BondsTab({ molecule }: { readonly molecule: Molecule }): React.ReactElement | null {
  const { t } = useTranslation('panels');
  const metrics = useMemo(() => selectBondMetrics(molecule), [molecule]);
  if (!metrics) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <h3 className="mb-2 text-sm font-medium text-fg-primary">
          {t('moleculeInfo.bond.length')}
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-fg-muted">
              <th>Bond</th>
              <th>{t('moleculeInfo.bond.order')}</th>
              <th>{t('moleculeInfo.bond.length')} (Å)</th>
            </tr>
          </thead>
          <tbody>
            {metrics.lengths.map((m) => (
              <tr key={m.bondIndex} className="text-fg-primary">
                <td>
                  {m.atom1Symbol}
                  {m.atom1Index} — {m.atom2Symbol}
                  {m.atom2Index}
                </td>
                <td>{m.order}</td>
                <td>{m.lengthAngstrom.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium text-fg-primary">{t('moleculeInfo.bond.angle')}</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-fg-muted">
              <th>Vertex</th>
              <th>{t('moleculeInfo.bond.angle')} (°)</th>
            </tr>
          </thead>
          <tbody>
            {metrics.angles.map((a, i) => (
              <tr
                key={`${a.atom1Index}-${a.atom2Index}-${a.atom3Index}-${i}`}
                className="text-fg-primary"
              >
                <td>
                  {a.atom1Index} — {a.atom2Index} — {a.atom3Index}
                </td>
                <td>{a.angleDegrees.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
