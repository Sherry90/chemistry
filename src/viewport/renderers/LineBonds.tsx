// Phase 14 §5.3 / §6.4 — LineSegments 결합 렌더러. lodLevel='line' 또는
// renderMode='wireframe' 시 cylinder BondInstances 대신 마운트.
// v1: 분자 추가/제거에만 재계산 (useMemo). atom drag 시점의 BufferAttribute
// 직접 갱신은 phase-15 polish 위임 (명세 §5.3).
import type * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, LineBasicMaterial } from 'three';
import type { LineSegments } from 'three';
import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import { getElement } from '@/chemistry/elements';

interface Props {
  readonly molecules: ReadonlyArray<Molecule>;
  // Phase 15 §6.2 (I3) — LineBasicMaterial opacity 로 전달 (transparent on).
  readonly fadeOpacity?: number;
}

export function LineBonds({ molecules, fadeOpacity }: Props): React.ReactElement {
  const meshRef = useRef<LineSegments>(null);

  // position + color buffers 구축. 결합당 2 vertex × 3 float.
  const { positions, colors } = useMemo(() => {
    let bondCount = 0;
    for (const m of molecules) bondCount += m.bonds.length;
    const positions = new Float32Array(bondCount * 6);
    const colors = new Float32Array(bondCount * 6);
    let i = 0;
    for (const m of molecules) {
      const atomById = new Map<AtomId, (typeof m.atoms)[number]>(m.atoms.map((a) => [a.id, a]));
      for (const b of m.bonds) {
        const a1 = atomById.get(b.aAtomId);
        const a2 = atomById.get(b.bAtomId);
        if (!a1 || !a2) continue;
        positions[i] = a1.position.x;
        positions[i + 1] = a1.position.y;
        positions[i + 2] = a1.position.z;
        positions[i + 3] = a2.position.x;
        positions[i + 4] = a2.position.y;
        positions[i + 5] = a2.position.z;
        const e1 = getElement(a1.elementNumber);
        const e2 = getElement(a2.elementNumber);
        const c1 = hexToRgb(e1?.cpkColorHex ?? '#888888');
        const c2 = hexToRgb(e2?.cpkColorHex ?? '#888888');
        colors[i] = c1.r;
        colors[i + 1] = c1.g;
        colors[i + 2] = c1.b;
        colors[i + 3] = c2.r;
        colors[i + 4] = c2.g;
        colors[i + 5] = c2.b;
        i += 6;
      }
    }
    return { positions, colors };
  }, [molecules]);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () => new LineBasicMaterial({ vertexColors: true, transparent: true }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // I3 — fade 시 material.opacity 갱신 (전 분자 공유 X — LineBonds 인스턴스마다 own).
  useEffect(() => {
    material.opacity = fadeOpacity ?? 1;
  }, [material, fadeOpacity]);

  // R3F intrinsic <lineSegments>. count=0 일 때도 마운트 (빈 geometry).
  return <lineSegments ref={meshRef} geometry={geometry} material={material} />;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { r, g, b };
}
