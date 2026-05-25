// Phase 08 §6.8 — 한 분자 컨테이너 + RenderMode exhaustive 분기.
// Phase 14 §6.4 W3-C1 retrofit — 4 RenderMode 갈래 + LineBonds swap:
//   - 'ball-and-stick' (default) : BallAndStickRenderer (lod 에 따라 cylinder/LineBonds).
//   - 'space-filling'            : AtomInstances (vdW) + AromaticOverlay (결합 숨김 — D4).
//   - 'wireframe'                : LineBonds + AromaticOverlay (원자 구체 숨김 — D5).
//   - 'stick'                    : BondInstances cylinder + AromaticOverlay (원자 구체 숨김 — D6).
// lodLevel 은 useLodContext (Scene 의 LodProvider) 에서 수신 — 3단계 hysteresis.
// Phase 15 §6.3 (I4) — atom drag/select 컨트롤러를 여기서 생성하여 자식에 props 로
// 전달 (useThree 기반 camera/controls/canvas size 의존성 단일화).
import type * as React from 'react';
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useMoleculeStore, useSettingsStore, selectMoleculeById, selectRenderMode } from '@/stores';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { BallAndStickRenderer } from './ball-and-stick/BallAndStickRenderer';
import { AtomInstances } from './ball-and-stick/AtomInstances';
import { BondInstances } from './ball-and-stick/BondInstances';
import { AromaticOverlay } from './ball-and-stick/AromaticOverlay';
import { LineBonds } from './LineBonds';
import { SelectionHalo } from './AtomHighlight';
import { MoleculeAccentBox } from './MoleculeAccentBox';
import { useLodContext } from './lod/LodContext';
import { useAtomMatrixSubscription } from '../subscriptions/usePositionSubscription';
import { useFadeOnMount } from '../animations/useFadeOnMount';
import { createDragController, type DragController } from '../interactions/usePointerDrag';
import type { MoleculeLayoutTransform } from '../scene/layout';

export function MoleculeGroup({
  molId,
  transform,
  fadeOpacity,
}: {
  readonly molId: MoleculeId;
  readonly transform: MoleculeLayoutTransform;
  // Phase 09 §6.7 (D15) — fade wrapper 가 주입.
  // Phase 15 §6.2 (I3) — 모든 RenderMode 갈래의 자식에게 prop 으로 threading,
  // 자식은 InstancedMesh material 의 (cloned) opacity 에 적용. cloned material 은
  // pool 마다 격리되어 단일 분자 fade 가 다른 분자에 누출되지 않음.
  readonly fadeOpacity?: number;
}): React.ReactElement | null {
  const selector = useMemo(() => selectMoleculeById(molId), [molId]);
  const molecule = useMoleculeStore(selector);
  const renderMode = useSettingsStore(selectRenderMode);
  const lod = useLodContext();

  // 좌표 이동 fast-path (React 리렌더 없이 setMatrixAt). unmount 시 자동 unsub.
  const subscription = useAtomMatrixSubscription(molId);

  // I3 — mount fade-in (useFrame 기반, Canvas 내부). exit fade(=fadeOpacity from wrapper) 와
  // 합성 → 단일 op 로 자식에 전달. 단일 호출 site 로 renderer 간 desync 방지 (advisor).
  const { opacity: mountOpacity } = useFadeOnMount();

  // I4 — atom drag controller. camera/controls/canvas size 의존성을 useThree 로 수집하여
  // 메모이즈된 instance 를 자식에 전달. 인스턴스 identity 안정성으로 내부 drag state 보존.
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const dragController = useMemo<DragController>(
    () =>
      createDragController({
        camera,
        getCanvasSize: () => {
          const el = gl.domElement;
          return { width: el.clientWidth, height: el.clientHeight };
        },
        getControls: () => controls,
        subscription,
      }),
    [camera, gl, controls, subscription],
  );

  // LineBonds 의 molecules prop — molecule 변경 시에만 재할당.
  const lineMolecules = useMemo(() => (molecule ? [molecule] : []), [molecule]);

  if (!molecule) return null;

  const op = (fadeOpacity ?? 1) * mountOpacity;
  const [tx, ty, tz] = transform.translation;
  return (
    <group position={[tx, ty, tz]}>
      {(() => {
        switch (renderMode) {
          case 'ball-and-stick':
            return (
              <BallAndStickRenderer
                molecule={molecule}
                lod={lod}
                fadeOpacity={op}
                dragController={dragController}
              />
            );
          case 'space-filling':
            // D4 — vdW 구체만, 결합 숨김. aromatic 은 §6.4 line 802 정합 유지.
            return (
              <>
                <AtomInstances
                  molecule={molecule}
                  lodLevel={lod}
                  renderMode="space-filling"
                  fadeOpacity={op}
                  dragController={dragController}
                />
                <AromaticOverlay molecule={molecule} fadeOpacity={op} />
              </>
            );
          case 'wireframe':
            // D5 — 결합 line, 원자 구체 숨김.
            return (
              <>
                <LineBonds molecules={lineMolecules} fadeOpacity={op} />
                <AromaticOverlay molecule={molecule} fadeOpacity={op} />
              </>
            );
          case 'stick':
            // D6 — 실린더 결합 유지, 원자 구체 숨김. lod==='line' 시 LineBonds 로 대체.
            return (
              <>
                {lod === 'line' ? (
                  <LineBonds molecules={lineMolecules} fadeOpacity={op} />
                ) : (
                  <BondInstances
                    molecule={molecule}
                    lodLevel={lod}
                    renderMode="stick"
                    fadeOpacity={op}
                  />
                )}
                <AromaticOverlay molecule={molecule} fadeOpacity={op} />
              </>
            );
          default: {
            // RenderMode 유니온 확장 시 컴파일 에러로 강제 (silent fallback 금지, §6.8).
            const _exhaustive: never = renderMode;
            throw new Error(`Unimplemented RenderMode: ${String(_exhaustive)}`);
          }
        }
      })()}
      {/* Phase 15 hotfix — 선택된 atom 가시 피드백 (모든 renderMode 공통). */}
      <SelectionHalo molecule={molecule} renderMode={renderMode} />
      {/* Phase 15 hotfix — 멀티 분자 시 분자 단위 색상 구분 wireframe box. */}
      <MoleculeAccentBox molecule={molecule} />
    </group>
  );
}
