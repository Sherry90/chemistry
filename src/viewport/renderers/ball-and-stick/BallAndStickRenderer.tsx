// Phase 08 §6.8 — ball-and-stick 단일 갈래 (atoms + bonds + aromatic + labels + hover).
import type * as React from 'react';
import { useState, useCallback } from 'react';
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
import { getAtomIdFromIntersection } from '../../ids/picking';
import { resolveBackground } from '../../scene/Background';
import type { HoverState, LodLevel } from '../../_shared/types';

export function BallAndStickRenderer({
  molecule,
  lod,
}: {
  readonly molecule: Molecule;
  readonly lod: LodLevel;
}): React.ReactElement {
  const [hover, setHover] = useState<HoverState | null>(null);
  const labelsOn = useUiStore(selectAtomLabelsOn);
  const cvdOn = useSettingsStore(selectIsCvdOn);
  const theme = useSettingsStore(selectTheme);
  const override = useUiStore(selectBackgroundOverride);
  const bg = resolveBackground(theme, override as 'theme' | 'light' | 'dark');
  const labelColor = bg.hex === '#FFFFFF' ? '#000000' : '#FFFFFF';
  const showLabels = labelsOn || cvdOn;

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const picked = getAtomIdFromIntersection(e);
    if (picked?.kind === 'atom') {
      setHover({ molId: picked.molId, atomId: picked.atomId, screen: [e.clientX, e.clientY] });
    }
  }, []);
  const onPointerOut = useCallback(() => setHover(null), []);

  return (
    <group>
      <AtomInstances
        molecule={molecule}
        lod={lod}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      <BondInstances molecule={molecule} lod={lod} />
      <AromaticOverlay molecule={molecule} />
      {showLabels && <AtomLabels molecule={molecule} color={labelColor} />}
      {hover && hover.molId === molecule.id && (
        <HoverTooltip molecule={molecule} atomId={hover.atomId} />
      )}
    </group>
  );
}
