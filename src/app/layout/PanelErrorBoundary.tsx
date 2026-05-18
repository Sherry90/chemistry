// Phase 10 §6.5 / D4 / R3 — 슬롯별 보조 ErrorBoundary. 해당 영역만 fallback +
// Retry (한도 3). 런타임 예외만 (P5). AppErrorBoundary 가 상위 안전망.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PanelKey } from '@/stores';
import { logger } from '@/utils/logger';

export type SlotName = 'toolbar' | 'sidepanel' | 'modal' | 'viewport';

export interface PanelErrorFallbackProps {
  readonly error: Error;
  readonly reset: () => void;
  readonly attemptCount: number;
  readonly panelKey?: PanelKey | undefined;
  readonly slotName: SlotName;
}

interface Props {
  readonly children: ReactNode;
  readonly slotName: SlotName;
  readonly panelKey?: PanelKey | undefined;
}
interface State {
  readonly error: Error | null;
  readonly attemptCount: number;
}

const MAX_ATTEMPTS = 3; // D4 / R3

function PanelErrorFallback({ error, reset, attemptCount, slotName }: PanelErrorFallbackProps) {
  const { t } = useTranslation('common');
  const exhausted = attemptCount >= MAX_ATTEMPTS;
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg-panel p-6 text-center"
    >
      <p className="text-sm font-medium text-error">
        {t('app.panelError.title', { slot: slotName })}
      </p>
      <p className="max-w-xs text-xs text-fg-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        disabled={exhausted}
        className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        {exhausted ? t('app.panelError.retryExhausted') : t('app.panelError.retry')}
      </button>
    </div>
  );
}

export class PanelErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, attemptCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('panel-boundary.caught', {
      slotName: this.props.slotName,
      panelKey: this.props.panelKey,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    if (this.state.attemptCount >= MAX_ATTEMPTS) return;
    this.setState((s) => ({ error: null, attemptCount: s.attemptCount + 1 }));
  };

  override render(): ReactNode {
    const { error, attemptCount } = this.state;
    if (error) {
      return (
        <PanelErrorFallback
          error={error}
          reset={this.reset}
          attemptCount={attemptCount}
          slotName={this.props.slotName}
          panelKey={this.props.panelKey}
        />
      );
    }
    return this.props.children;
  }
}
