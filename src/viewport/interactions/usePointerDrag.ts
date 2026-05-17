// Phase 09 §4.6 / §6.2 (D4/D12/P8/P4) — atom 드래그 (카메라 평면 투영).
// 의도적 deviation (P8 suspend/resume 의미): 본 구현은 매 mousemove 마다
// `moveAtom` 액션을 디스패치하고, Phase 08 `useAtomMatrixSubscription` 이 그
// 변화를 받아 setMatrixAt 으로 직접 갱신한다(React 리렌더 0회). 즉 드래그가
// *직접* setMatrixAt 을 호출하지 않으므로 실제 구독을 suspend 하면 시각 갱신이
// 멈춘다. 따라서 실 경로(Scene)는 no-op 핸들을 주입하고, suspend/resume 계약은
// 컨트롤러 API 표면에서만 보존(테스트가 mock 핸들로 검증, §8.3). DoD 의
// "setMatrixAt 직접 갱신 + React 리렌더 0회" 는 구독 위임으로 충족.
import * as THREE from 'three';
import { useMoleculeStore, beginUndoGroup, endUndoGroup } from '@/stores';
import type { PickedTarget } from '../ids/picking';
import type { PositionSubscriptionHandle } from '../subscriptions/usePositionSubscription';
import { atomIdToIndex } from '../ids/lookup';
import type { MoleculeId, AtomId } from '@/chemistry/compounds/ids';

export interface DragState {
  readonly molId: MoleculeId;
  readonly atomId: AtomId;
  readonly initialPosition: readonly [number, number, number];
  readonly plane: THREE.Plane;
  readonly groupKey: string; // "drag:${atomId}" — P4 ambient group
  readonly startedAt: number;
}

export interface DragControllerDeps {
  readonly camera: THREE.Camera;
  readonly raycaster?: THREE.Raycaster;
  readonly getCanvasSize: () => { readonly width: number; readonly height: number };
  readonly getControls: () => { enabled: boolean } | null;
  /** 드래그 분자 구독 — P8 계약 (실 경로는 no-op, 테스트는 mock). */
  readonly subscription: PositionSubscriptionHandle;
  readonly now?: () => number;
}

/** 클릭 시점 atom 깊이를 고정하는 카메라-법선 평면 (D4). */
export function buildDragPlane(
  camera: THREE.Camera,
  p: readonly [number, number, number],
): THREE.Plane {
  const n = camera.getWorldDirection(new THREE.Vector3());
  return new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(p[0], p[1], p[2]));
}

/** client 좌표 → NDC → 평면 교차 월드 좌표. 교차 없으면 null. */
export function unprojectToPlane(
  clientX: number,
  clientY: number,
  size: { readonly width: number; readonly height: number },
  camera: THREE.Camera,
  plane: THREE.Plane,
  raycaster: THREE.Raycaster,
): [number, number, number] | null {
  const ndc = new THREE.Vector2((clientX / size.width) * 2 - 1, -(clientY / size.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, out) ? [out.x, out.y, out.z] : null;
}

export interface DragController {
  onPointerDown(picked: PickedTarget | null, clientX: number, clientY: number): boolean;
  onPointerMove(clientX: number, clientY: number): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  getState(): DragState | null;
}

export function createDragController(deps: DragControllerDeps): DragController {
  const raycaster = deps.raycaster ?? new THREE.Raycaster();
  const clock = deps.now ?? Date.now;
  let drag: DragState | null = null;

  function begin(picked: PickedTarget | null, _cx: number, _cy: number): boolean {
    if (!picked || picked.kind !== 'atom') return false;
    const mol = useMoleculeStore.getState().molecules[picked.molId];
    if (!mol) return false;
    const idx = atomIdToIndex(mol, picked.atomId);
    if (idx < 0) return false;
    const a = mol.atoms[idx]!;
    const p: [number, number, number] = [a.position.x, a.position.y, a.position.z];
    const groupKey = `drag:${picked.atomId}`;
    drag = {
      molId: picked.molId,
      atomId: picked.atomId,
      initialPosition: p,
      plane: buildDragPlane(deps.camera, p),
      groupKey,
      startedAt: clock(),
    };
    deps.subscription.suspend(); // P8 (계약 보존)
    const c = deps.getControls();
    if (c) c.enabled = false; // D12
    beginUndoGroup(groupKey); // P4 — groupless moveAtom 을 이 group 으로 합치기
    return true;
  }

  function move(cx: number, cy: number): void {
    if (!drag) return;
    const target = unprojectToPlane(
      cx,
      cy,
      deps.getCanvasSize(),
      deps.camera,
      drag.plane,
      raycaster,
    );
    if (!target) return;
    const mol = useMoleculeStore.getState().molecules[drag.molId];
    if (!mol) return void cleanup(); // R2 — drag 중 분자 삭제 race
    const idx = atomIdToIndex(mol, drag.atomId);
    if (idx < 0) return void cleanup();
    useMoleculeStore.getState().actions.moveAtom(drag.molId, idx, target);
  }

  function cleanup(): void {
    if (!drag) return;
    deps.subscription.resume();
    const c = deps.getControls();
    if (c) c.enabled = true;
    endUndoGroup(); // ambient group 해제 (pending 은 D3 — 200ms/다른 액션/undo 시 flush)
    drag = null;
  }

  return {
    onPointerDown: (picked, cx, cy) => begin(picked, cx, cy),
    onPointerMove: (cx, cy) => move(cx, cy),
    onPointerUp: () => cleanup(), // pointer-up 자체는 flush 트리거 아님 (D3)
    onPointerCancel: () => cleanup(),
    getState: () => drag,
  };
}
