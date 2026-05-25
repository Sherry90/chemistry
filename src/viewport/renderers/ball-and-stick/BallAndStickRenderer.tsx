// Phase 08 §6.8 — ball-and-stick 단일 갈래 (atoms + bonds + aromatic + labels + hover).
// Phase 14 §6.4 W3-C1 retrofit: lodLevel === 'line' 시 BondInstances → LineBonds 로 swap.
//   AtomInstances 는 line 레벨에서도 소형 sphere 유지 (segments 6/3, atom picking 보존).
// Phase 15 §6.2 (I3) — fadeOpacity (exit) × mountOpacity (enter, useFadeOnMount) 합성을
//   여기서 단일화하여 자식에게 prop 으로 전달 (renderer 별 독립 clock 방지 — advisor).
import type * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Molecule } from '@/chemistry/compounds/types';
import {
  useUiStore,
  useSettingsStore,
  selectAtomLabelsOn,
  selectIsCvdOn,
  selectBackgroundOverride,
  selectTheme,
} from '@/stores';
import { AtomInstances } from './AtomInstances';
import { BondInstances } from './BondInstances';
import { AromaticOverlay } from './AromaticOverlay';
import { AtomLabels } from './AtomLabels';
import { HoverTooltip } from './HoverTooltip';
import { HoverHalo } from '../AtomHighlight';
import { LineBonds } from '../LineBonds';
import { getAtomIdFromIntersection } from '../../ids/picking';
import { resolveBackground } from '../../scene/Background';
import type { HoverState, LodLevel } from '../../_shared/types';
import type { DragController } from '../../interactions/usePointerDrag';

export function BallAndStickRenderer({
  molecule,
  lod,
  fadeOpacity,
  dragController,
}: {
  readonly molecule: Molecule;
  readonly lod: LodLevel;
  readonly fadeOpacity?: number;
  readonly dragController?: DragController;
}): React.ReactElement {
  const [hover, setHover] = useState<HoverState | null>(null);
  const labelsOn = useUiStore(selectAtomLabelsOn);
  const cvdOn = useSettingsStore(selectIsCvdOn);
  const theme = useSettingsStore(selectTheme);
  const override = useUiStore(selectBackgroundOverride);
  const bg = resolveBackground(theme, override as 'theme' | 'light' | 'dark');
  const labelColor = bg.hex === '#FFFFFF' ? '#000000' : '#FFFFFF';
  const showLabels = labelsOn || cvdOn;

  // LineBonds 의 molecules prop (단일 분자 wrap).
  const lineMolecules = useMemo(() => [molecule], [molecule]);

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const picked = getAtomIdFromIntersection(e);
    if (picked?.kind === 'atom') {
      setHover({ molId: picked.molId, atomId: picked.atomId, screen: [e.clientX, e.clientY] });
    }
  }, []);
  const onPointerOut = useCallback(() => setHover(null), []);

  const op = fadeOpacity ?? 1;

  return (
    <group>
      <AtomInstances
        molecule={molecule}
        lodLevel={lod}
        renderMode="ball-and-stick"
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        fadeOpacity={op}
        {...(dragController ? { dragController } : {})}
      />
      {lod === 'line' ? (
        <LineBonds molecules={lineMolecules} fadeOpacity={op} />
      ) : (
        <BondInstances
          molecule={molecule}
          lodLevel={lod}
          renderMode="ball-and-stick"
          fadeOpacity={op}
        />
      )}
      <AromaticOverlay molecule={molecule} fadeOpacity={op} />
      {showLabels && <AtomLabels molecule={molecule} color={labelColor} fadeOpacity={op} />}
      {hover && hover.molId === molecule.id && (
        <HoverTooltip molecule={molecule} atomId={hover.atomId} />
      )}
      {/* Phase 15 hotfix — hover atom 가시 피드백 (ball-and-stick 한정 — 다른
          renderMode 는 hover 상태 미보유). */}
      <HoverHalo
        molecule={molecule}
        renderMode="ball-and-stick"
        atomId={hover && hover.molId === molecule.id ? hover.atomId : null}
      />
    </group>
  );
}
