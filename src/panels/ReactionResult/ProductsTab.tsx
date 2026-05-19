// Phase 11 §6.5 — 생성물 카드 리스트 (MoleculeCard 재사용).
import type * as React from 'react';
import type { Molecule } from '@/chemistry/compounds/types';
import { MoleculeCard } from '../_shared/MoleculeCard';

export function ProductsTab({
  products,
  isExperimental,
  onAddOne,
}: {
  readonly products: ReadonlyArray<Molecule>;
  readonly isExperimental: boolean;
  readonly onAddOne: (m: Molecule) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 p-4">
      {products.map((m, i) => (
        <MoleculeCard
          key={m.id ?? i}
          molecule={m}
          source="reaction-product"
          badge={isExperimental ? 'experimental' : null}
          actions={{ onAddToWorkspace: () => onAddOne(m) }}
        />
      ))}
    </div>
  );
}
