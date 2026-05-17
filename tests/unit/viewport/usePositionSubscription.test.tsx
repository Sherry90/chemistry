// Phase 08 §8.10 의도 — 좌표 이동 시 InstancedMesh.setMatrixAt 직접 갱신, React 리렌더 0회.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import * as THREE from 'three';

vi.mock('@/engine', () => ({
  parseSmiles: vi.fn(),
  parseInchi: vi.fn(),
  toMoleculeWith3D: vi.fn(),
}));
vi.mock('@/engine/reaction', () => ({ predict: vi.fn() }));
vi.mock('@/services/pubchem', () => ({
  getCompoundByCid: vi.fn(),
  resolveCompoundByName: vi.fn(),
}));
vi.mock('@/data/compounds', () => ({ searchCompoundManifest: vi.fn(() => []) }));

import { useMoleculeStore } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { useAtomMatrixSubscription } from '@/viewport/subscriptions/usePositionSubscription';
import { atomPoolRegistry, allocAtomSlot } from '@/viewport/_shared/poolRegistry';
import { fakeMolecule, hardReset } from '../stores/_helpers';
import type { ElementNumber } from '@/chemistry/elements/types';

const geom = new THREE.SphereGeometry(1, 4, 4);
const mat = new THREE.MeshBasicMaterial();

beforeEach(() => {
  atomPoolRegistry.clearAll();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
});

describe('useAtomMatrixSubscription', () => {
  it('moveAtom updates the pool matrix WITHOUT a React re-render', () => {
    const m = fakeMolecule();
    const a0 = m.atoms[0]!;
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });

    const pool = atomPoolRegistry.ensure(m.id, a0.elementNumber as ElementNumber, geom, mat);
    allocAtomSlot(pool, a0.id);

    const renders = { n: 0 };
    renderHook(() => {
      const c = useRef(0);
      c.current += 1;
      renders.n = c.current;
      useAtomMatrixSubscription(m.id);
    });
    const beforeRenders = renders.n;

    act(() => {
      useMoleculeStore.getState().actions.moveAtom(m.id, 0, [5, 6, 7]);
    });

    // 리렌더 0회 (구독은 React 밖).
    expect(renders.n).toBe(beforeRenders);
    // 풀 매트릭스가 새 좌표로 갱신됨.
    const out = new THREE.Matrix4();
    pool.mesh.getMatrixAt(pool.atomIdToSlot.get(a0.id)!, out);
    const t = new THREE.Vector3().setFromMatrixPosition(out);
    expect([t.x, t.y, t.z]).toEqual([5, 6, 7]);
  });

  it('suspend() halts updates until resume()', () => {
    const m = fakeMolecule();
    const a0 = m.atoms[0]!;
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    const pool = atomPoolRegistry.ensure(m.id, a0.elementNumber as ElementNumber, geom, mat);
    allocAtomSlot(pool, a0.id);

    const { result } = renderHook(() => useAtomMatrixSubscription(m.id));
    act(() => result.current.suspend());
    act(() => useMoleculeStore.getState().actions.moveAtom(m.id, 0, [1, 1, 1]));

    const out = new THREE.Matrix4();
    pool.mesh.getMatrixAt(0, out);
    const t = new THREE.Vector3().setFromMatrixPosition(out);
    expect([t.x, t.y, t.z]).toEqual([0, 0, 0]); // 변경 안 됨 (suspended)

    act(() => result.current.resume());
    act(() => useMoleculeStore.getState().actions.moveAtom(m.id, 0, [2, 2, 2]));
    pool.mesh.getMatrixAt(0, out);
    const t2 = new THREE.Vector3().setFromMatrixPosition(out);
    expect([t2.x, t2.y, t2.z]).toEqual([2, 2, 2]);
  });
});
