// Phase 11 §8.1 U4 + U5 — moleculeStore.addFromMolecule / addFromMolecules.
// commit semantics 만 검증 (undo 실행은 phase-09 dispatcher 가 swap 후 동작 —
// placeholder dispatcher 환경의 본 테스트는 dispatchUndoable 콜백 실행 결과의
// state 변화 + id 재발급 + group batch 만 검증).
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { useMoleculeStore, __resetMoleculeInternals } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { useReactionStore } from '@/stores/reactionStore';
import { makeInitialReactionState } from '@/stores/reactionStore.types';
import { fakeMolecule, hardReset } from '../stores/_helpers';

beforeEach(() => {
  __resetMoleculeInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useReactionStore, makeInitialReactionState);
  vi.clearAllMocks();
});

describe('moleculeStore — addFromMolecule (U4)', () => {
  it('단일 entry 커밋 → ids 1, activeId 갱신, atoms 보존', () => {
    const m = fakeMolecule();
    const newId = useMoleculeStore.getState().actions.addFromMolecule(m);

    const st = useMoleculeStore.getState();
    expect(st.ids).toHaveLength(1);
    expect(st.ids[0]).toBe(newId);
    expect(st.activeId).toBe(newId);
    expect(st.molecules[newId]!.atoms).toHaveLength(2);
    expect(st.molecules[newId]!.canonicalSmiles).toBe('CO');
  });

  it('반환 id 는 fixture.id 와 다른 새 brand (withRegeneratedIds)', () => {
    const m = fakeMolecule();
    const newId = useMoleculeStore.getState().actions.addFromMolecule(m);
    expect(newId).not.toBe(m.id);
    // 내부 atoms / bonds 도 새 ID 로 재발급되었는지 검증.
    const stored = useMoleculeStore.getState().molecules[newId]!;
    expect(stored.atoms[0]!.id).not.toBe(m.atoms[0]!.id);
  });

  it('두 번 호출 → ids 2, activeId = 두 번째 id', () => {
    const a = useMoleculeStore.getState().actions.addFromMolecule(fakeMolecule());
    const b = useMoleculeStore
      .getState()
      .actions.addFromMolecule(fakeMolecule({ canonicalSmiles: 'B' }));
    const st = useMoleculeStore.getState();
    expect(st.ids).toEqual([a, b]);
    expect(st.activeId).toBe(b);
  });
});

describe('moleculeStore — addFromMolecules (U5)', () => {
  it('빈 배열 → ids 0, store 변화 없음', () => {
    const before = useMoleculeStore.getState().ids.length;
    const ids = useMoleculeStore.getState().actions.addFromMolecules([]);
    expect(ids).toEqual([]);
    expect(useMoleculeStore.getState().ids.length).toBe(before);
    expect(useMoleculeStore.getState().activeId).toBeNull();
  });

  it('2 개 분자 → ids 2, store 2 분자, activeId = 마지막', () => {
    const ms = [fakeMolecule(), fakeMolecule({ canonicalSmiles: 'X' })];
    const ids = useMoleculeStore.getState().actions.addFromMolecules(ms);

    expect(ids).toHaveLength(2);
    const st = useMoleculeStore.getState();
    expect(st.ids).toEqual(ids);
    expect(st.activeId).toBe(ids[1]);
    expect(st.molecules[ids[1]!]!.canonicalSmiles).toBe('X');
  });

  it('반환 id 모두 입력 분자 id 와 다름 (재발급)', () => {
    const ms = [fakeMolecule(), fakeMolecule()];
    const ids = useMoleculeStore.getState().actions.addFromMolecules(ms);
    expect(ids[0]).not.toBe(ms[0]!.id);
    expect(ids[1]).not.toBe(ms[1]!.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
