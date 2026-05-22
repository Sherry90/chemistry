// Phase 08 §6.1 — Scene 합성 (Background/Lighting/OrbitControls/Molecules/ApiBridge).
// Phase 14 §5.2 / §6.4 W3-C1 retrofit — LodProvider 로 분자 그룹 트리를 감싸 lodLevel
// 을 MoleculeGroup 자손에 broadcast (useLodContext 소비). hysteresis 는 useLodLevel 내부.
import type * as React from 'react';
import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useMoleculeStore, selectMoleculeIds } from '@/stores';
import { Background } from './Background';
import { Lighting } from './Lighting';
import { ViewportApiBridge } from './ViewportApiBridge';
import { computeMoleculeLayout, type MoleculeLayoutTransform } from './layout';
import { MoleculeGroup } from '../renderers/MoleculeGroup';
import { LodProvider } from '../renderers/lod/LodContext';
import { withMoleculeFade } from '../animations/useMoleculeFade';
import { useSelectionStaleGuard } from '../subscriptions/selectionGuard';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import type { ViewportApi } from '../_shared/types';

// Phase 09 §6.7 (D15) — MoleculeGroup 을 fade wrapper 로 감쌈 (mount fade-in 은
// inner 책임, unmount 시 delayed real-unmount). 모듈-레벨 정의 — 매 렌더 재생성
// 시 remount 되므로 컴포넌트 identity 안정 필수. 명시 타입 인자: 제네릭이
// 교차타입에서 fadeOpacity 를 역산 못 하므로 외부 props 를 직접 지정.
const FadedMoleculeGroup = withMoleculeFade<{
  readonly molId: MoleculeId;
  readonly transform: MoleculeLayoutTransform;
}>(MoleculeGroup);

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
      <LodProvider>
        {ids.map((id) => (
          <FadedMoleculeGroup
            key={id}
            molId={id}
            transform={layout.get(id) ?? { translation: [0, 0, 0] }}
          />
        ))}
      </LodProvider>
      <ViewportApiBridge apiRef={apiRef} />
    </>
  );
}
