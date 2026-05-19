import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
// Phase 11 §6.10 — App = <AppLayout><ToolbarBar/></>. Phase 01 placeholder
// toolbar(title+LocaleToggle) 제거 → 스모크는 ToolbarBar/WebGL2 fallback 기준.
import { AppErrorBoundary } from '@/app/layout';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { App } from '@/app/App';

function renderApp() {
  return render(
    <AppErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>
    </AppErrorBoundary>,
  );
}

describe('App smoke tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('마운트 무crash — Toolbar(undo 버튼) + WebGL2 fallback(jsdom)', async () => {
    renderApp();
    // ToolbarBar EditGroup 의 Undo IconButton (panels ns 'Undo' 라벨).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });
    // jsdom = WebGL2 미지원 → ViewportHost 가 fallback (영문 기본 locale).
    expect(screen.getByText('WebGL2 not supported')).toBeInTheDocument();
    // AppErrorBoundary fallback 미발생.
    expect(screen.queryByText('Application error')).toBeNull();
  });

  it('언어 토글 (AppGroup) → ko 전환', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('WebGL2 not supported')).toBeInTheDocument();
    });
    // AppGroup 의 Language IconButton (aria-label = panels:toolbar.language 'Language').
    await user.click(screen.getByRole('button', { name: /language/i }));
    await waitFor(() => {
      expect(screen.getByText('WebGL2 미지원')).toBeInTheDocument();
    });
  });
});
