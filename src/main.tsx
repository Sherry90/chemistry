import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Phase 10 §12.1 retrofit — Phase 01 <ErrorBoundary> → <AppErrorBoundary>
// (정적 영문 fallback + 디자인 토큰, D15).
import { AppErrorBoundary } from '@/app/layout';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { App } from '@/app/App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
