// Phase 08 §6.1 — Scene 합성 (Background/Lighting/OrbitControls/Molecules/ApiBridge).
import type * as React from 'react';
import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useMoleculeStore, selectMoleculeIds } from '@/stores';
import { Background } from './Background';
import { Lighting } from './Lighting';
import { ViewportApiBridge } from './ViewportApiBridge';
import { computeMoleculeLayout } from './layout';
import { MoleculeGroup } from '../renderers/MoleculeGroup';
import { useSelectionStaleGuard } from '../subscriptions/selectionGuard';
import type { ViewportApi } from '../_shared/types';

export function Scene({
  apiRef,
}: {
  readonly apiRef?: React.Ref<ViewportApi> | undefined;
}): React.ReactElement {
  const ids = useMoleculeStore(selectMoleculeIds);
  const moleculesMap = useMoleculeStore((s) => s.molecules);
  const molecules = useMemo(
    () => ids.map((id) => moleculesMap[id]).filter((m) => Boolean(m)),
    [ids, moleculesMap],
  );
  const layout = useMemo(
    () => computeMoleculeLayout(molecules.filter((m) => m != null)),
    [molecules],
  );

  useSelectionStaleGuard();

  return (
    <>
      <Background />
      <Lighting />
      <OrbitControls enabled enableDamping dampingFactor={0.08} makeDefault />
      {ids.map((id) => (
        <MoleculeGroup
          key={id}
          molId={id}
          transform={layout.get(id) ?? { translation: [0, 0, 0] }}
        />
      ))}
      <ViewportApiBridge apiRef={apiRef} />
    </>
  );
}
