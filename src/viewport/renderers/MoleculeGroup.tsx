// Phase 08 §6.8 — 한 분자 컨테이너 + RenderMode exhaustive 분기.
// Phase 14 §6.4 W3-C1 retrofit — 4 RenderMode 갈래 + LineBonds swap:
//   - 'ball-and-stick' (default) : BallAndStickRenderer (lod 에 따라 cylinder/LineBonds).
//   - 'space-filling'            : AtomInstances (vdW) + AromaticOverlay (결합 숨김 — D4).
//   - 'wireframe'                : LineBonds + AromaticOverlay (원자 구체 숨김 — D5).
//   - 'stick'                    : BondInstances cylinder + AromaticOverlay (원자 구체 숨김 — D6).
// lodLevel 은 useLodContext (Scene 의 LodProvider) 에서 수신 — 3단계 hysteresis.
import type * as React from 'react';
import { useMemo } from 'react';
import { useMoleculeStore, useSettingsStore, selectMoleculeById, selectRenderMode } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { BallAndStickRenderer } from './ball-and-stick/BallAndStickRenderer';
import { AtomInstances } from './ball-and-stick/AtomInstances';
import { BondInstances } from './ball-and-stick/BondInstances';
import { AromaticOverlay } from './ball-and-stick/AromaticOverlay';
import { LineBonds } from './LineBonds';
import { useLodContext } from './lod/LodContext';
import { useAtomMatrixSubscription } from '../subscriptions/usePositionSubscription';
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
  const lod = useLodContext();

  // 좌표 이동 fast-path (React 리렌더 없이 setMatrixAt). unmount 시 자동 unsub.
  useAtomMatrixSubscription(molId);

  // LineBonds 의 molecules prop — molecule 변경 시에만 재할당.
  const lineMolecules = useMemo(() => (molecule ? [molecule] : []), [molecule]);

  if (!molecule) return null;

  const [tx, ty, tz] = transform.translation;
  return (
    <group position={[tx, ty, tz]}>
      {(() => {
        switch (renderMode) {
          case 'ball-and-stick':
            return <BallAndStickRenderer molecule={molecule} lod={lod} />;
          case 'space-filling':
            // D4 — vdW 구체만, 결합 숨김. aromatic 은 §6.4 line 802 정합 유지.
            return (
              <>
                <AtomInstances molecule={molecule} lodLevel={lod} renderMode="space-filling" />
                <AromaticOverlay molecule={molecule} />
              </>
            );
          case 'wireframe':
            // D5 — 결합 line, 원자 구체 숨김.
            return (
              <>
                <LineBonds molecules={lineMolecules} />
                <AromaticOverlay molecule={molecule} />
              </>
            );
          case 'stick':
            // D6 — 실린더 결합 유지, 원자 구체 숨김. lod==='line' 시 LineBonds 로 대체.
            return (
              <>
                {lod === 'line' ? (
                  <LineBonds molecules={lineMolecules} />
                ) : (
                  <BondInstances molecule={molecule} lodLevel={lod} renderMode="stick" />
                )}
                <AromaticOverlay molecule={molecule} />
              </>
            );
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
