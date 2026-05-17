// Phase 08 §6.7.1 — 원자 라벨 (drei Text 빌보드). CVD on 이면 강제 표시 (§6.7.3).
import type * as React from 'react';
import { Text } from '@react-three/drei';
import type { Molecule } from '@/chemistry/compounds/types';
import { getElement } from '@/chemistry/elements';

export function AtomLabels({
  molecule,
  color,
}: {
  readonly molecule: Molecule;
  readonly color: string;
}): React.ReactElement {
  return (
    <>
      {molecule.atoms.map((a) => (
        <Text
          key={a.id}
          position={[a.position.x, a.position.y, a.position.z]}
          fontSize={0.5}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {getElement(a.elementNumber).symbol}
        </Text>
      ))}
    </>
  );
}
