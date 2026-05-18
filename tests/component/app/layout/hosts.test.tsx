// Phase 10 §8.2 — ToastContainer(C8) / WebGL2FallbackPage(C9) /
// LoadingOverlay(C10) / SidePanelHost(C3) / ModalHost(C5).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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

import { useUiStore } from '@/stores/uiStore';
import { makeInitialUiState } from '@/stores/uiStore.types';
import { ToastContainer } from '@/app/layout/ToastContainer';
import { WebGL2FallbackPage } from '@/app/layout/WebGL2FallbackPage';
import { LoadingOverlay } from '@/app/layout/LoadingOverlay';
import { SidePanelHost } from '@/app/layout/SidePanelHost';
import { ModalHost } from '@/app/layout/ModalHost';
import { registerPanel, __resetPanelRegistry } from '@/app/layout/panels/PanelRegistry';
import { hardReset } from '../../../unit/stores/_helpers';

beforeEach(() => {
  hardReset(useUiStore, makeInitialUiState);
  __resetPanelRegistry();
});

describe('ToastContainer (C8)', () => {
  it('notify → 항목 렌더, dismiss → 제거', () => {
    render(<ToastContainer />);
    let id = '';
    act(() => {
      id = useUiStore.getState().actions.notify({ level: 'info', messageKey: 'msg.a' });
    });
    expect(screen.getByText('msg.a')).toBeInTheDocument();
    act(() => {
      useUiStore.getState().actions.dismissNotification(id);
    });
    expect(screen.queryByText('msg.a')).toBeNull();
  });
});

describe('WebGL2FallbackPage (C9)', () => {
  it('result.ok=false → i18n 키 + region role', () => {
    render(<WebGL2FallbackPage result={{ ok: false, reason: 'no-webgl2' }} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('app.webgl2Unsupported.title')).toBeInTheDocument();
    expect(screen.getByText('app.webgl2Unsupported.reason')).toBeInTheDocument();
  });
});

describe('LoadingOverlay (C10)', () => {
  it("variant='app' — globalLoading.count>0 시 표시 + role=alert", () => {
    const { rerender } = render(<LoadingOverlay variant="app" />);
    expect(screen.queryByRole('alert')).toBeNull();
    useUiStore.getState().actions.beginLoading();
    rerender(<LoadingOverlay variant="app" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it("variant='viewport' — visible prop 로만 제어 (globalLoading 무관)", () => {
    useUiStore.getState().actions.beginLoading();
    const { rerender, container } = render(<LoadingOverlay variant="viewport" />);
    expect(container).toBeEmptyDOMElement(); // visible 미지정 → false
    rerender(<LoadingOverlay variant="viewport" visible />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('SidePanelHost (C3)', () => {
  it('active=docked 패널 → lazy 마운트; 미등록 → empty', async () => {
    render(<SidePanelHost />);
    expect(screen.getByText('panels.empty.hint')).toBeInTheDocument();

    registerPanel({
      key: 'periodic-table',
      mode: 'docked',
      i18nTitleKey: 'panels.periodicTable.title',
      load: () => Promise.resolve({ default: () => <div data-testid="pt">PT</div> }),
    });
    useUiStore.getState().actions.setActivePanel('periodic-table');
    await waitFor(() => expect(screen.getByTestId('pt')).toBeInTheDocument());
    expect(screen.getByText('panels.periodicTable.title')).toBeInTheDocument();
  });

  it("mode='modal' 정의는 docked 호스트에서 무시", () => {
    registerPanel({
      key: 'periodic-table',
      mode: 'modal',
      i18nTitleKey: 'x',
      load: () => Promise.resolve({ default: () => <div>M</div> }),
    });
    useUiStore.getState().actions.setActivePanel('periodic-table');
    render(<SidePanelHost />);
    expect(screen.getByText('panels.empty.hint')).toBeInTheDocument();
  });
});

describe('ModalHost (C5)', () => {
  it('isPeriodicTableOpen=true → Dialog 열림; Esc → toggle(false)', async () => {
    registerPanel({
      key: 'periodic-table',
      mode: 'modal',
      i18nTitleKey: 'panels.periodicTable.title',
      load: () => Promise.resolve({ default: () => <div data-testid="ptm">PTM</div> }),
    });
    useUiStore.getState().actions.togglePeriodicTable(true);
    render(<ModalHost />);

    await waitFor(() => expect(screen.getByTestId('ptm')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
      code: 'Escape',
    });
    await waitFor(() => expect(useUiStore.getState().panels.isPeriodicTableOpen).toBe(false));
  });
});
