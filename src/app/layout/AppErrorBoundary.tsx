// Phase 10 §6.5 / D15 — Phase 01 <ErrorBoundary> retrofit 교체. 정적 영문
// fallback (i18n 부팅 실패 안전) + 디자인 토큰. 런타임 예외만 포착 (P5 —
// 도메인 실패는 Result 패턴으로 stores 반영).
import { Component, createElement } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logger } from '@/utils/logger';

export interface AppErrorFallbackProps {
  readonly error: Error;
  readonly reset: () => void; // 페이지 새로고침 권장
}

interface Props {
  readonly children: ReactNode;
}
interface State {
  readonly error: Error | null;
}

function AppErrorFallback({ error }: AppErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-canvas text-fg-primary">
      <div className="max-w-md p-6 rounded-md border border-border bg-bg-panel">
        <h1 className="text-lg font-semibold text-error">Application error</h1>
        <p className="mt-2 text-sm text-fg-muted">
          An unexpected error occurred. Please reload the page.
        </p>
        <pre className="mt-4 max-h-32 overflow-auto text-xs text-fg-muted">{error.message}</pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent/90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('app-boundary.caught', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  override render(): ReactNode {
    if (this.state.error) {
      return createElement(AppErrorFallback, {
        error: this.state.error,
        reset: () => window.location.reload(),
      });
    }
    return this.props.children;
  }
}
