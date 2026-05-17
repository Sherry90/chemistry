// Phase 08 §6.8 — 한 분자 컨테이너 + RenderMode exhaustive 분기.
import type * as React from 'react';
import { useMemo } from 'react';
import { useMoleculeStore, useSettingsStore, selectMoleculeById, selectRenderMode } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { BallAndStickRenderer } from './ball-and-stick/BallAndStickRenderer';
import { useAtomMatrixSubscription } from '../subscriptions/usePositionSubscription';
import { selectAtomCountAcrossAll } from '../subscriptions/selectors';
import { pickLodLevel } from '../_shared/lod';
import type { MoleculeLayoutTransform } from '../scene/layout';

export function MoleculeGroup({
  molId,
  transform,
}: {
  readonly molId: MoleculeId;
  readonly transform: MoleculeLayoutTransform;
  // Phase 09 §6.7 (D15) — fade wrapper 가 주입. 인스턴스 머티리얼 opacity 로의
  // 실 threading 은 Phase 15 (시각 회귀) — 본 Phase 는 delayed-unmount 계약만.
  readonly fadeOpacity?: number;
}): React.ReactElement | null {
  const selector = useMemo(() => selectMoleculeById(molId), [molId]);
  const molecule = useMoleculeStore(selector);
  const renderMode = useSettingsStore(selectRenderMode);
  const totalAtoms = useMoleculeStore(selectAtomCountAcrossAll);
  const lod = pickLodLevel(totalAtoms);

  // 좌표 이동 fast-path (React 리렌더 없이 setMatrixAt). unmount 시 자동 unsub.
  useAtomMatrixSubscription(molId);

  if (!molecule) return null;

  const [tx, ty, tz] = transform.translation;
  return (
    <group position={[tx, ty, tz]}>
      {(() => {
        switch (renderMode) {
          case 'ball-and-stick':
            return <BallAndStickRenderer molecule={molecule} lod={lod} />;
          default: {
            // RenderMode 유니온 확장 시 컴파일 에러로 강제 (silent fallback 금지, §6.8).
            const _exhaustive: never = renderMode;
            throw new Error(`Unimplemented RenderMode: ${String(_exhaustive)}`);
          }
        }
      })()}
    </group>
  );
}
