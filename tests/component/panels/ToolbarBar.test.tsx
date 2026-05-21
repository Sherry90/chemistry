// Phase 11 §8.2 C6 — ToolbarBar 14 슬롯 + Undo/Redo disabled 기본 + 그룹별 액션.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

import ToolbarBar from '@/panels/Toolbar/ToolbarBar';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { TooltipProvider } from '@/components';
import { useMoleculeStore, useReactionStore, useUiStore, useSettingsStore } from '@/stores';
import { makeInitialMoleculeState } from '@/stores/moleculeStore.types';
import { makeInitialReactionState } from '@/stores/reactionStore.types';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { __resetMoleculeInternals } from '@/stores/moleculeStore';
import { hardReset } from '../../unit/stores/_helpers';
import type { ViewportApi } from '@/viewport';
import type { RefObject } from 'react';

function buildViewportApiMock(overrides: Partial<ViewportApi> = {}): ViewportApi {
  return {
    frameActive: vi.fn(),
    frameAll: vi.fn(),
    resetCamera: vi.fn(),
    captureBlob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
    createBondFromSelection: vi.fn(() => false),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    getRenderer: vi.fn(() => null as never),
    ...overrides,
  } as ViewportApi;
}

function renderToolbar(api: ViewportApi) {
  const apiRef: RefObject<ViewportApi | null> = { current: api };
  return render(
    <I18nProvider>
      <TooltipProvider>
        <ToolbarBar apiRef={apiRef} />
      </TooltipProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  __resetMoleculeInternals();
  hardReset(useMoleculeStore, makeInitialMoleculeState);
  hardReset(useReactionStore, makeInitialReactionState);
  hardReset(useUiStore, makeInitialUiState);
  useSettingsStore.setState({ theme: 'light' });
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ToolbarBar — slot inventory + disabled state', () => {
  it('14 컨트롤 렌더 (4 EditGroup + 4 ViewportGroup + 3 DisplayGroup + 3 AppGroup)', async () => {
    renderToolbar(buildViewportApiMock());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });
    // IconButton 11 개 (Undo, Redo, CreateBond, SMILES, FrameActive, FrameAll,
    // ResetCamera, Capture, RenderMode, Background, Language, Shortcuts) + Switch 2 개
    // (Labels, Theme) + Popover trigger 안의 IconButton 중복 → role=button 합산 13~14.
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(12);
    // Switch (Radix) 는 role=switch.
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
  });

  it('Undo / Redo 기본 disabled (canUndo=canRedo=false)', async () => {
    renderToolbar(buildViewportApiMock());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });
});

describe('ToolbarBar — ViewportGroup actions', () => {
  it('Frame Active 클릭 → api.frameActive 호출', async () => {
    const api = buildViewportApiMock();
    renderToolbar(api);
    const btn = await screen.findByRole('button', { name: /frame active/i });
    await userEvent.click(btn);
    expect(api.frameActive).toHaveBeenCalledTimes(1);
  });

  it('Reset Camera 클릭 → api.resetCamera 호출', async () => {
    const api = buildViewportApiMock();
    renderToolbar(api);
    const btn = await screen.findByRole('button', { name: /reset camera/i });
    await userEvent.click(btn);
    expect(api.resetCamera).toHaveBeenCalledTimes(1);
  });

  it('Capture 클릭 → api.captureBlob 호출 (jsdom URL/anchor stub)', async () => {
    const createObjUrl = vi.fn(() => 'blob:fake');
    const revokeObjUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjUrl, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjUrl, configurable: true });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const api = buildViewportApiMock();
    renderToolbar(api);
    const btn = await screen.findByRole('button', { name: /capture png/i });
    await userEvent.click(btn);

    await waitFor(() => expect(api.captureBlob).toHaveBeenCalledTimes(1));
    expect(api.captureBlob).toHaveBeenCalledWith({ format: 'png', dpr: 2 });
    expect(createObjUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjUrl).toHaveBeenCalled();
  });
});

describe('ToolbarBar — EditGroup CreateBond / SMILES placeholder', () => {
  it('Create Bond 클릭 → api.createBondFromSelection=false → notify warn 큐 추가', async () => {
    const api = buildViewportApiMock({ createBondFromSelection: vi.fn(() => false) });
    renderToolbar(api);
    const btn = await screen.findByRole('button', { name: /create bond/i });
    await userEvent.click(btn);

    expect(api.createBondFromSelection).toHaveBeenCalledTimes(1);
    const notes = useUiStore.getState().notifications;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.level).toBe('warn');
    expect(notes[0]!.messageKey).toBe('shortcuts.bondCreate.diffMolecule');
  });

  it('SMILES 버튼 클릭 → notify info placeholder', async () => {
    renderToolbar(buildViewportApiMock());
    const btn = await screen.findByRole('button', { name: /smiles input/i });
    await userEvent.click(btn);

    const notes = useUiStore.getState().notifications;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.level).toBe('info');
    expect(notes[0]!.messageKey).toBe('panels:toolbar.smilesInputPlaceholder');
  });
});

describe('ToolbarBar — DisplayGroup / AppGroup toggles', () => {
  it('원자 라벨 Switch 토글 → uiStore.atomLabelsOn 반영', async () => {
    renderToolbar(buildViewportApiMock());
    const labels = await screen.findByRole('switch', { name: /atom labels/i });
    expect(useUiStore.getState().viewport.showAtomLabels).toBe(false);
    await userEvent.click(labels);
    expect(useUiStore.getState().viewport.showAtomLabels).toBe(true);
  });

  it('테마 Switch 토글 → settingsStore.theme dark', async () => {
    renderToolbar(buildViewportApiMock());
    const themeSwitch = await screen.findByRole('switch', { name: /theme/i });
    expect(useSettingsStore.getState().theme).toBe('light');
    await userEvent.click(themeSwitch);
    expect(useSettingsStore.getState().theme).toBe('dark');
  });
});
