// Phase 08 §6.9 / §6.10 (D13/D14) — imperative ViewportApi (Canvas 내부, useThree 사용).
import type * as React from 'react';
import { useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMoleculeStore, phase07PlaceholderDispatcher } from '@/stores';
import {
  computeBBox,
  computeMoleculeLayout,
  computeAggregateBBox,
  type MoleculeBBox,
} from './layout';
import { selectMoleculesArray } from '../subscriptions/selectors';
import {
  CAMERA_DISTANCE_FACTOR,
  DEFAULT_CAMERA_DIR,
  MIN_CAMERA_DISTANCE,
} from '../_shared/constants';
import type { ViewportApi } from '../_shared/types';

interface OrbitLike {
  target: THREE.Vector3;
  update(): void;
  reset(): void;
}

const _dir = new THREE.Vector3();

function placeCamera(
  camera: THREE.Camera,
  controls: OrbitLike | null,
  centerWorld: readonly [number, number, number],
  diagonal: number,
): void {
  const target = new THREE.Vector3(centerWorld[0], centerWorld[1], centerWorld[2]);
  const distance = Math.max(diagonal * CAMERA_DISTANCE_FACTOR, MIN_CAMERA_DISTANCE);
  _dir.set(DEFAULT_CAMERA_DIR[0], DEFAULT_CAMERA_DIR[1], DEFAULT_CAMERA_DIR[2]).normalize();
  camera.position.copy(target).addScaledVector(_dir, distance);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  if (controls) {
    controls.target.copy(target);
    controls.update();
  }
}

/** activeId 분자의 월드 BBox (layout translation 적용). */
function activeWorldBBox(): { center: readonly [number, number, number]; diagonal: number } | null {
  const st = useMoleculeStore.getState();
  const mols = selectMoleculesArray(st);
  if (mols.length === 0) return null;
  const layout = computeMoleculeLayout(mols);
  const activeId = st.activeId ?? mols[0]!.id;
  const mol = st.molecules[activeId];
  if (!mol) return null;
  const b: MoleculeBBox = computeBBox(mol);
  const t = layout.get(activeId)?.translation ?? [0, 0, 0];
  return {
    center: [b.center[0] + t[0], b.center[1] + t[1], b.center[2] + t[2]],
    diagonal: b.diagonal,
  };
}

function allWorldBBox(): { center: readonly [number, number, number]; diagonal: number } | null {
  const st = useMoleculeStore.getState();
  const mols = selectMoleculesArray(st);
  if (mols.length === 0) return null;
  const layout = computeMoleculeLayout(mols);
  const agg = computeAggregateBBox(
    mols.map((m) => ({
      molecule: m,
      transform: layout.get(m.id) ?? { translation: [0, 0, 0] as const },
    })),
  );
  return { center: agg.center, diagonal: agg.diagonal };
}

export function ViewportApiBridge({
  apiRef,
}: {
  apiRef?: React.Ref<ViewportApi> | undefined;
}): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;

  useImperativeHandle(
    apiRef,
    (): ViewportApi => ({
      frameActive: () => {
        const b = activeWorldBBox();
        if (b) placeCamera(camera, controls, b.center, b.diagonal);
      },
      frameAll: () => {
        const b = allWorldBBox();
        if (b) placeCamera(camera, controls, b.center, b.diagonal);
      },
      resetCamera: () => {
        const b = activeWorldBBox();
        if (b) placeCamera(camera, controls, b.center, b.diagonal);
        controls?.reset();
      },
      captureBlob: async (opts) => {
        const prevDpr = gl.getPixelRatio();
        if (opts.dpr) gl.setPixelRatio(opts.dpr);
        const prevClear = new THREE.Color();
        gl.getClearColor(prevClear);
        const prevAlpha = gl.getClearAlpha();
        if (opts.transparentBackground) gl.setClearColor(0x000000, 0);
        gl.render(scene, camera);
        const blob = await new Promise<Blob>((resolve, reject) => {
          gl.domElement.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
            'image/png',
          );
        });
        gl.setPixelRatio(prevDpr);
        gl.setClearColor(prevClear, prevAlpha);
        gl.render(scene, camera);
        return blob;
      },
      getRenderer: () => gl,
      // ── Phase 09 가 stub 본문 교체 (인터페이스는 본 Phase 소유) ──
      canUndo: () => phase07PlaceholderDispatcher.canUndo(),
      canRedo: () => phase07PlaceholderDispatcher.canRedo(),
      createBondFromSelection: () => false,
    }),
    [gl, scene, camera, controls],
  );

  return null;
}
