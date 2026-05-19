// Phase 11 §6.1 — PeriodicTable 모달 패널 (registerPanel.load default export).
import type * as React from 'react';
import { useState } from 'react';
import { getPeriodicTableLayout } from '@/chemistry/elements';
import type { Element } from '@/chemistry/elements';
import { useUiStore } from '@/stores';
import { Separator } from '@/components';
import { PeriodicGrid } from './PeriodicGrid';
import { ElementInfoSheet } from './ElementInfoSheet';

export default function PeriodicTablePanel(): React.ReactElement {
  const layout = getPeriodicTableLayout();
  const [selected, setSelected] = useState<Element | null>(null);
  const notify = useUiStore((s) => s.actions.notify);

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodicGrid layout={layout} onSelect={setSelected} selected={selected} />
      {selected && (
        <>
          <Separator />
          <ElementInfoSheet
            element={selected}
            onStartMolecule={() =>
              notify({
                level: 'info',
                messageKey: 'panels:periodicTable.element.startMoleculePlaceholder',
                dismissAfterMs: 3000,
              })
            }
          />
        </>
      )}
    </div>
  );
}
