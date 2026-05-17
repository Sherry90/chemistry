// Phase 08 §6.7.2 (D10) — 호버 툴팁 (drei Html). 로컬 hover state, 멀티 hit 은 Phase 09.
import type * as React from 'react';
import { Html } from '@react-three/drei';
import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import { getElement } from '@/chemistry/elements';

export function HoverTooltip({
  molecule,
  atomId,
}: {
  readonly molecule: Molecule;
  readonly atomId: AtomId;
}): React.ReactElement | null {
  const atom = molecule.atoms.find((a) => a.id === atomId);
  if (!atom) return null;
  const el = getElement(atom.elementNumber);
  return (
    <Html
      position={[atom.position.x, atom.position.y, atom.position.z]}
      occlude
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.78)',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        {el.symbol} ({el.nameKo} / {el.nameEn}) · q{atom.formalCharge} · H{atom.implicitHCount}
      </div>
    </Html>
  );
}
