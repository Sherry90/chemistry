// Phase 10 §8.2 C1/C2 / P6 / R7 — AppLayout 슬롯 마운트 + unmount 시 전역
// 단축키 cleanup (window listener 누수 0). jsdom: WebGL2 mock false →
// ViewportHost 가 fallback (lazy R3F 회피).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const { undoCleanup, installGlobalUndoShortcuts, detectWebGL2 } = vi.hoisted(() => {
  const c = vi.fn();
  return {
    undoCleanup: c,
    installGlobalUndoShortcuts: vi.fn(() => c),
    detectWebGL2: vi.fn(() => ({ ok: false, reason: 'no-webgl2' })),
  };
});
// @/viewport 배럴 mock — installGlobalUndoShortcuts(cleanup spy) + detectWebGL2
// + lazy default(미사용: WebGL2 false 라 ViewportHost 가 먼저 fallback).
vi.mock('@/viewport', () => ({
  installGlobalUndoShortcuts,
  detectWebGL2,
  default: () => null,
}));

import AppLayout from '@/app/layout/AppLayout';
import { useUiStore } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { hardReset } from '../../../unit/stores/_helpers';

beforeEach(() => {
  hardReset(useUiStore, makeInitialUiState);
  undoCleanup.mockClear();
  installGlobalUndoShortcuts.mockClear();
});

describe('AppLayout (C1/C2)', () => {
  it('C1 — toolbar 주입 + 슬롯 마운트 (sidepanel empty / viewport WebGL2 fallback)', () => {
    render(<AppLayout toolbar={<span data-testid="tb">TB</span>} />);
    expect(screen.getByTestId('tb')).toBeInTheDocument();
    // SidePanelHost (등록 없음 → empty hint)
    expect(screen.getByText('panels.empty.hint')).toBeInTheDocument();
    // ViewportHost → WebGL2FallbackPage (detect mock false)
    expect(screen.getByText('app.webgl2Unsupported.title')).toBeInTheDocument();
    // 전역 단축키 설치 (P6 mount)
    expect(installGlobalUndoShortcuts).toHaveBeenCalledTimes(1);
  });

  it('C2 / P6 / R7 — unmount 시 전역 단축키 cleanup 호출', () => {
    const { unmount } = render(<AppLayout />);
    expect(undoCleanup).not.toHaveBeenCalled();
    unmount();
    expect(undoCleanup).toHaveBeenCalledTimes(1);
  });
});
