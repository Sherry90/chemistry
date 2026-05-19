// Phase 11 §6.4 — R/S atom stereo + E/Z bond stereo 표 (phase-03 stereo).
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Molecule } from '@/chemistry/compounds/types';

export function StereoTab({ molecule }: { readonly molecule: Molecule }): React.ReactElement {
  const { t } = useTranslation('panels');
  const { atomStereo, bondStereo } = molecule.stereo;

  if (atomStereo.length === 0 && bondStereo.length === 0) {
    return <p className="p-4 text-sm text-fg-muted">{t('moleculeInfo.stereo.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      {atomStereo.length > 0 && (
        <table className="w-full">
          <thead>
            <tr className="text-left text-fg-muted">
              <th>Atom</th>
              <th>R/S</th>
            </tr>
          </thead>
          <tbody>
            {atomStereo.map((a) => (
              <tr key={a.atomIdx} className="text-fg-primary">
                <td>{a.atomIdx}</td>
                <td>{a.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {bondStereo.length > 0 && (
        <table className="w-full">
          <thead>
            <tr className="text-left text-fg-muted">
              <th>Bond</th>
              <th>E/Z</th>
            </tr>
          </thead>
          <tbody>
            {bondStereo.map((b) => (
              <tr key={b.bondIdx} className="text-fg-primary">
                <td>{b.bondIdx}</td>
                <td>{b.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
