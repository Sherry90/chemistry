// Phase 11 §6.1 / Phase 12 §6.8 — PeriodicTable 모달 패널 (registerPanel.load
// default export). 원소 → "분자 시작" 클릭 시 TextInput 모달로 seed 전달 후
// PeriodicTable 자체는 닫는다 (모달 스택 1 개 유지).
import type * as React from 'react';
import { useState } from 'react';
import { getPeriodicTableLayout } from '@/chemistry/elements';
import type { Element } from '@/chemistry/elements';
import { useUiStore } from '@/stores';
import { Separator } from '@/components';
import { PeriodicGrid } from './PeriodicGrid';
import { ElementInfoSheet } from './ElementInfoSheet';
import { getElementInitialFormula } from '@/panels/TextInput/seedHelpers';

export default function PeriodicTablePanel(): React.ReactElement {
  const layout = getPeriodicTableLayout();
  const [selected, setSelected] = useState<Element | null>(null);
  const setTextInputInitial = useUiStore((s) => s.actions.setTextInputInitial);
  const toggleTextInput = useUiStore((s) => s.actions.toggleTextInput);
  const togglePeriodicTable = useUiStore((s) => s.actions.togglePeriodicTable);

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodicGrid layout={layout} onSelect={setSelected} selected={selected} />
      {selected && (
        <>
          <Separator />
          <ElementInfoSheet
            element={selected}
            onStartMolecule={() => {
              setTextInputInitial({ kind: 'formula', raw: getElementInitialFormula(selected) });
              toggleTextInput(true);
              togglePeriodicTable(false);
            }}
          />
        </>
      )}
    </div>
  );
}
