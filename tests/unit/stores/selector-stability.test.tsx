import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

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
import { selectActiveMolecule } from '@/stores/moleculeStore.selectors';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { hardReset } from './_helpers';

beforeEach(() => {
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useUiStore, makeInitialUiState);
});

describe('selector stability', () => {
  it('unrelated store update does NOT re-render a selectActiveMolecule subscriber', () => {
    const { result } = renderHook(() => {
      const renders = useRef(0);
      renders.current += 1;
      useMoleculeStore(selectActiveMolecule);
      return renders;
    });

    const initial = result.current.current;
    act(() => {
      useUiStore.getState().actions.toggleAtomLabels(true);
      useUiStore.getState().actions.beginLoading();
    });
    expect(result.current.current).toBe(initial); // no re-render
  });

  it('primitive selector re-renders only on relevant change', () => {
    const { result } = renderHook(() => {
      const renders = useRef(0);
      renders.current += 1;
      const count = useMoleculeStore((s) => s.ids.length);
      return { renders, count };
    });

    const before = result.current.renders.current;
    act(() => {
      useUiStore.getState().actions.setActivePanel('toolbar');
    });
    expect(result.current.renders.current).toBe(before);
    expect(result.current.count).toBe(0);
  });
});
