import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Phase 10 §12.1 retrofit — Phase 01 <ErrorBoundary> → <AppErrorBoundary>
// (정적 영문 fallback + 디자인 토큰, D15).
import { AppErrorBoundary } from '@/app/layout';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { App } from '@/app/App';
import { installE2EBackdoor } from '@/app/_e2e';
import { setRdkitBackend, createMainThreadRdkitBackend } from '@/engine';

// Phase 15 §6.1 retrofit — parser/index.ts `getBackend()` 가 throw 하지 않도록
// 런타임 main-thread 백엔드를 부팅 1회 주입. 기존 phase-03 추상화 (worker 분리
// 결정 deferred) 의 런타임 미설치 갭 해소.
setRdkitBackend(createMainThreadRdkitBackend());

// Phase 15 §6.1 — `?e2e=1` 인 경우만 window.__e2e__ 노출 (평시 no-op).
installE2EBackdoor();

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
