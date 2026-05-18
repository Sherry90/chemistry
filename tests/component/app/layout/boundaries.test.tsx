// Phase 10 §8.2 C6/C7 — PanelErrorBoundary 슬롯 격리 + Retry 한도 3 (D4/R3).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { PanelErrorBoundary } from '@/app/layout/PanelErrorBoundary';

function Boom({ on }: { on: boolean }) {
  if (on) throw new Error('boom-msg');
  return <div data-testid="ok">ok</div>;
}

beforeEach(() => {
  // React 18 logs caught errors to console.error — silence for clean output.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PanelErrorBoundary', () => {
  it('자식 throw → 해당 슬롯만 fallback (다른 슬롯 정상)', () => {
    render(
      <>
        <PanelErrorBoundary slotName="sidepanel">
          <Boom on />
        </PanelErrorBoundary>
        <PanelErrorBoundary slotName="toolbar">
          <Boom on={false} />
        </PanelErrorBoundary>
      </>,
    );
    expect(screen.getByText('app.panelError.title')).toBeInTheDocument();
    expect(screen.getByText('boom-msg')).toBeInTheDocument();
    expect(screen.getByTestId('ok')).toBeInTheDocument(); // 다른 슬롯 정상
  });

  it('Retry 3회 후 버튼 disabled (한도 D4)', () => {
    render(
      <PanelErrorBoundary slotName="viewport">
        <Boom on />
      </PanelErrorBoundary>,
    );
    // 자식이 계속 throw → Retry 마다 즉시 재 fallback. 3회 후 retryExhausted.
    for (let i = 0; i < 3; i++) {
      const btn = screen.getByRole('button');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
    }
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(screen.getByText('app.panelError.retryExhausted')).toBeInTheDocument();
  });
});
