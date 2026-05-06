import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { App } from '@/app/App';

function renderApp() {
  return render(
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>,
  );
}

describe('App smoke tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders without crashing and shows English title by default', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Chemistry Simulation Platform')).toBeInTheDocument();
    });
  });

  it('switches to Korean when locale toggle is clicked', async () => {
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Chemistry Simulation Platform')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /한국어/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('화학 시뮬레이션 플랫폼')).toBeInTheDocument();
    });
  });
});
