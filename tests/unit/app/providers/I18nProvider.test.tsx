// Phase 15 §6.6 / I10 — initI18n 실패 → AppErrorBoundary 정적 영문 fallback.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { initI18n, setLocale, i18n } = vi.hoisted(() => ({
  initI18n: vi.fn(),
  setLocale: vi.fn(),
  i18n: { on: vi.fn(), off: vi.fn() },
}));
vi.mock('@/i18n', () => ({ initI18n, setLocale, i18n }));

import { I18nProvider } from '@/app/providers/I18nProvider';
import { AppErrorBoundary } from '@/app/layout/AppErrorBoundary';

describe('I18nProvider init 실패', () => {
  it('initI18n reject → AppErrorBoundary 정적 영문 fallback 표시', async () => {
    initI18n.mockRejectedValueOnce(new Error('i18n bundle load failed'));
    // ErrorBoundary 가 catch 시 console.error 호출 — 테스트 노이즈 차단.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <I18nProvider>
          <p>inner</p>
        </I18nProvider>
      </AppErrorBoundary>,
    );
    await waitFor(() => expect(screen.getByText('Application error')).toBeTruthy());
    expect(screen.getByText(/i18n bundle load failed/)).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('initI18n resolve → children 렌더', async () => {
    initI18n.mockResolvedValueOnce(undefined);
    render(
      <AppErrorBoundary>
        <I18nProvider>
          <p>inner-ok</p>
        </I18nProvider>
      </AppErrorBoundary>,
    );
    await waitFor(() => expect(screen.getByText('inner-ok')).toBeTruthy());
  });
});
