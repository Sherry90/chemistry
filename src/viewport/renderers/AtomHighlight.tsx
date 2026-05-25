// Phase 15 hotfix — selection/hover 시각 피드백.
// 원자 픽킹 자체는 동작(picking.ts) 하지만 선택된 atom 이 외형 변화 없어
// 사용자가 "클릭 안 됨" 으로 오인. 본 컴포넌트는 selection.atomIds 및 hover atom
// 위치에 반투명 sphere shell 을 덧씌워 가시 피드백을 제공한다. CPK 색상은 손대지
// 않음 (재료 동결, advisor).
import * as THREE from 'three';
import { useMemo } from 'react';
import type * as React from 'react';
import type { Molecule } from '@/chemistry/compounds/types';
import type { AtomId } from '@/chemistry/compounds/ids';
import type { ElementNumber } from '@/chemistry/elements/types';
import { useUiStore, selectSelection } from '@/stores';
import { getElement } from '@/chemistry/elements';
import type { RenderMode } from '../_shared/types';
import { atomDisplayRadius } from '../_shared/radii';

const SELECTION_COLOR = '#FFD400';
const HOVER_COLOR = '#9AD7FF';
const SELECTION_SCALE = 1.55;
const HOVER_SCALE = 1.35;
const PM_TO_ANGSTROM = 0.01;

const SHARED_SPHERE = new THREE.SphereGeometry(1, 20, 12);

function haloBaseRadius(element: ElementNumber, renderMode: RenderMode): number {
  if (renderMode === 'space-filling') {
    const v = getElement(element).vdwRadiusPm;
    if (v != null) return v * PM_TO_ANGSTROM;
  }
  return atomDisplayRadius(element);
}

function Halo({
  atoms,
  renderMode,
  color,
  opacity,
  scale,
}: {
  readonly atoms: ReadonlyArray<Molecule['atoms'][number]>;
  readonly renderMode: RenderMode;
  readonly color: string;
  readonly opacity: number;
  readonly scale: number;
}): React.ReactElement {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    [color, opacity],
  );
  return (
    <group>
      {atoms.map((a) => {
        const r = haloBaseRadius(a.elementNumber, renderMode) * scale;
        return (
          <mesh
            key={a.id}
            position={[a.position.x, a.position.y, a.position.z]}
            scale={[r, r, r]}
            geometry={SHARED_SPHERE}
            material={material}
            renderOrder={999}
          />
        );
      })}
    </group>
  );
}

export function SelectionHalo({
  molecule,
  renderMode,
}: {
  readonly molecule: Molecule;
  readonly renderMode: RenderMode;
}): React.ReactElement | null {
  const selection = useUiStore(selectSelection);
  const selectedAtoms = useMemo(() => {
    const prefix = `${molecule.id}::a:`;
    return molecule.atoms.filter((a) => selection.atomIds.includes(`${prefix}${a.id}`));
  }, [selection.atomIds, molecule]);
  if (selectedAtoms.length === 0) return null;
  return (
    <Halo
      atoms={selectedAtoms}
      renderMode={renderMode}
      color={SELECTION_COLOR}
      opacity={0.45}
      scale={SELECTION_SCALE}
    />
  );
}

export function HoverHalo({
  molecule,
  renderMode,
  atomId,
}: {
  readonly molecule: Molecule;
  readonly renderMode: RenderMode;
  readonly atomId: AtomId | null;
}): React.ReactElement | null {
  const atom = atomId ? molecule.atoms.find((a) => a.id === atomId) : null;
  if (!atom) return null;
  return (
    <Halo
      atoms={[atom]}
      renderMode={renderMode}
      color={HOVER_COLOR}
      opacity={0.3}
      scale={HOVER_SCALE}
    />
  );
}
