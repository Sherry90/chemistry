// Phase 09 §8.3 — 드래그 평면/unproject + 컨트롤러 (controls 토글, P8, P4 group).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('@/engine', () => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));

import { useMoleculeStore } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { getCurrentUndoGroup } from '@/stores';
import {
  buildDragPlane,
  unprojectToPlane,
  createDragController,
} from '@/viewport/interactions/usePointerDrag';
import type { PickedTarget } from '@/viewport/ids/picking';
import type { MoleculeId, AtomId } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from '../../stores/_helpers';

function cam(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  c.position.set(0, 0, 5);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
}

function seed(): { molId: MoleculeId; atomId: AtomId } {
  const m = fakeMolecule(); // a0 at origin
  useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
  return { molId: m.id, atomId: 'a0' as AtomId };
}

beforeEach(() => hardReset(useMoleculeStore, makeInitialMoleculeState));

describe('drag geometry', () => {
  it('buildDragPlane normal = camera forward', () => {
    const c = cam();
    const plane = buildDragPlane(c, [0, 0, 0]);
    const fwd = c.getWorldDirection(new THREE.Vector3());
    expect(plane.normal.x).toBeCloseTo(fwd.x, 5);
    expect(plane.normal.y).toBeCloseTo(fwd.y, 5);
    expect(plane.normal.z).toBeCloseTo(fwd.z, 5);
  });

  it('unprojectToPlane → 평면 위 유한 좌표', () => {
    const c = cam();
    const plane = buildDragPlane(c, [0, 0, 0]); // z=0 평면
    const out = unprojectToPlane(
      50,
      50,
      { width: 100, height: 100 },
      c,
      plane,
      new THREE.Raycaster(),
    );
    expect(out).not.toBeNull();
    expect(out!.every((n) => Number.isFinite(n))).toBe(true);
    expect(out![2]).toBeCloseTo(0, 4); // z=0 평면 교차
  });
});

describe('createDragController', () => {
  function mkDeps() {
    const controls = { enabled: true };
    const subscription = { suspend: vi.fn(), resume: vi.fn() };
    const ctrl = createDragController({
      camera: cam(),
      getCanvasSize: () => ({ width: 100, height: 100 }),
      getControls: () => controls,
      subscription,
    });
    return { ctrl, controls, subscription };
  }

  it('atom pointerDown → controls off + suspend + ambient group; up → 복원', () => {
    const { molId, atomId } = seed();
    const { ctrl, controls, subscription } = mkDeps();
    const picked: PickedTarget = { kind: 'atom', molId, atomId };

    expect(ctrl.onPointerDown(picked, 50, 50)).toBe(true);
    expect(controls.enabled).toBe(false);
    expect(subscription.suspend).toHaveBeenCalledOnce();
    expect(getCurrentUndoGroup()).toBe(`drag:${atomId}`);
    expect(ctrl.getState()).not.toBeNull();

    ctrl.onPointerUp();
    expect(controls.enabled).toBe(true);
    expect(subscription.resume).toHaveBeenCalledOnce();
    expect(getCurrentUndoGroup()).toBeNull();
    expect(ctrl.getState()).toBeNull();
  });

  it('pointerMove ×5 → moveAtom 5회, group 동일', () => {
    // immer 가 actions 객체를 freeze → vi.spyOn 불가. store 구독으로 카운트.
    const { molId, atomId } = seed();
    const { ctrl } = mkDeps();
    let writes = 0;
    const unsub = useMoleculeStore.subscribe(
      (s) => s.molecules[molId],
      () => {
        writes++;
      },
    );
    ctrl.onPointerDown({ kind: 'atom', molId, atomId }, 50, 50);
    for (let i = 0; i < 5; i++) ctrl.onPointerMove(50 + i * 4, 50 - i * 3);
    expect(writes).toBe(5);
    expect(getCurrentUndoGroup()).toBe(`drag:${atomId}`);
    ctrl.onPointerUp();
    unsub();
  });

  it('atom 외 / null pick → 드래그 시작 안 함', () => {
    seed();
    const { ctrl } = mkDeps();
    expect(ctrl.onPointerDown(null, 10, 10)).toBe(false);
    expect(
      ctrl.onPointerDown({ kind: 'bond', molId: 'm' as MoleculeId, bondId: 'b' as never }, 10, 10),
    ).toBe(false);
    expect(ctrl.getState()).toBeNull();
  });

  it('드래그 중 분자 삭제 race → move 가 안전 종료 (R2)', () => {
    const { molId, atomId } = seed();
    const { ctrl, controls } = mkDeps();
    ctrl.onPointerDown({ kind: 'atom', molId, atomId }, 50, 50);
    useMoleculeStore.setState({ molecules: {}, ids: [], activeId: null });
    ctrl.onPointerMove(60, 60);
    expect(ctrl.getState()).toBeNull();
    expect(controls.enabled).toBe(true);
  });
});
