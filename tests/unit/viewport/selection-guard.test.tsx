// Phase 08 §8.8 — atom 삭제 후 stale selection 자동 정리.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
import { useUiStore } from '@/stores/uiStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { useSelectionStaleGuard } from '@/viewport/subscriptions/selectionGuard';
import { viewportIdForAtom } from '@/viewport/ids/viewportId';
import { fakeMolecule, hardReset } from '../stores/_helpers';

beforeEach(() => {
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useUiStore, makeInitialUiState);
});

describe('useSelectionStaleGuard', () => {
  it('clears selection entries whose atom was removed', () => {
    const m = fakeMolecule();
    const keptId = viewportIdForAtom(m.id, m.atoms[0]!.id);
    const staleId = viewportIdForAtom(m.id, m.atoms[1]!.id);
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    useUiStore.getState().actions.setSelection({ atomIds: [keptId, staleId] });

    renderHook(() => useSelectionStaleGuard());

    act(() => {
      useMoleculeStore.getState().actions.removeAtom(m.id, 1); // m.atoms[1] 제거
    });

    const sel = useUiStore.getState().selection.atomIds;
    expect(sel).toContain(keptId);
    expect(sel).not.toContain(staleId);
  });
});
