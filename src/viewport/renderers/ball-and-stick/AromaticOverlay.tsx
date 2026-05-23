// Phase 08 §6.3.3 (D3) — aromatic 결합 dashed inner (drei Line). Phase 14 가 ring-aware 교체.
import type * as React from 'react';
import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { Molecule, Atom } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import { AROMATIC_DASH_SIZE, AROMATIC_GAP_SIZE } from '../../_shared/constants';

export function AromaticOverlay({
  molecule,
  fadeOpacity,
}: {
  readonly molecule: Molecule;
  // Phase 15 §6.2 (I3) — drei Line 의 LineMaterial opacity 로 전달 (transparent on).
  readonly fadeOpacity?: number;
}): React.ReactElement | null {
  const segments = useMemo(() => {
    const byId = new Map<AtomId, Atom>();
    for (const a of molecule.atoms) byId.set(a.id, a);
    const segs: Array<[[number, number, number], [number, number, number]]> = [];
    for (const b of molecule.bonds) {
      if (b.order !== 'aromatic') continue;
      const a = byId.get(b.aAtomId);
      const c = byId.get(b.bAtomId);
      if (!a || !c) continue;
      // 결합 길이의 70% inner, 중앙 정렬.
      const t = 0.15;
      const ax = a.position,
        cx = c.position;
      segs.push([
        [ax.x + (cx.x - ax.x) * t, ax.y + (cx.y - ax.y) * t, ax.z + (cx.z - ax.z) * t],
        [
          ax.x + (cx.x - ax.x) * (1 - t),
          ax.y + (cx.y - ax.y) * (1 - t),
          ax.z + (cx.z - ax.z) * (1 - t),
        ],
      ]);
    }
    return segs;
  }, [molecule]);

  if (segments.length === 0) return null;
  const op = fadeOpacity ?? 1;
  return (
    <>
      {segments.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#888888"
          lineWidth={1}
          dashed
          dashSize={AROMATIC_DASH_SIZE}
          gapSize={AROMATIC_GAP_SIZE}
          transparent
          opacity={op}
        />
      ))}
    </>
  );
}
