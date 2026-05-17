// Phase 09 §8.8 — useMoleculeFadeWrapper: delayed real unmount (D15).
// 시각 보간 정밀도는 Phase 15 Playwright. 여기서는 delayed-unmount 계약만.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { render, act } from '@testing-library/react';
import { useMoleculeStore } from '@/stores/moleculeStore';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { withMoleculeFade } from '@/viewport/animations/useMoleculeFade';
import { __resetAnimationRegistry } from '@/viewport/animations/animationRegistry';
import type { MoleculeId } from '@/chemistry/compounds/ids';
import { fakeMolecule, hardReset } from '../../stores/_helpers';

function Inner({ fadeOpacity }: { molId: MoleculeId; fadeOpacity: number }) {
  return <div data-testid="mol" data-op={fadeOpacity} />;
}
const Wrapped = withMoleculeFade<{ molId: MoleculeId }>(Inner, {
  durationMs: 150,
});

beforeEach(() => {
  vi.useFakeTimers();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  __resetAnimationRegistry();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useMoleculeFadeWrapper', () => {
  it('분자 존재 → 렌더 (fadeOpacity 1)', () => {
    const m = fakeMolecule();
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    const { getByTestId } = render(<Wrapped molId={m.id} />);
    expect(getByTestId('mol').getAttribute('data-op')).toBe('1');
  });

  it('분자 제거 → durationMs 전 잔존, 이후 실제 unmount', async () => {
    const m = fakeMolecule();
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    const { queryByTestId } = render(<Wrapped molId={m.id} />);
    expect(queryByTestId('mol')).not.toBeNull();

    await act(async () => {
      useMoleculeStore.setState({ molecules: {}, ids: [], activeId: null });
    });
    await act(async () => {
      vi.advanceTimersByTime(100); // < 150ms — 아직 잔존 (fade-out 중)
    });
    expect(queryByTestId('mol')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(80); // 총 180ms > 150ms — 실 unmount
    });
    expect(queryByTestId('mol')).toBeNull();
  });

  it('exit 중 분자 재등장 → 취소 후 다시 표시', async () => {
    const m = fakeMolecule();
    useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    const { queryByTestId } = render(<Wrapped molId={m.id} />);

    await act(async () => {
      useMoleculeStore.setState({ molecules: {}, ids: [], activeId: null });
    });
    await act(async () => {
      vi.advanceTimersByTime(80); // exit 진행 중
    });
    await act(async () => {
      useMoleculeStore.setState({ molecules: { [m.id]: m }, ids: [m.id], activeId: m.id });
    });
    await act(async () => {
      vi.advanceTimersByTime(200); // 원래 removal 시점 지나도
    });
    expect(queryByTestId('mol')).not.toBeNull(); // 재등장 → 잔존
    expect(queryByTestId('mol')!.getAttribute('data-op')).toBe('1');
  });
});
