// Phase 10 §6.9 / D16 — LoadingOverlay. variant='app' 은 globalLoading 자동
// 구독 + role=alert; viewport/panel 은 Suspense fallback (visible prop).
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectIsGloballyLoading } from '@/stores';
import { Spinner, VisuallyHidden } from '@/components';

export type LoadingOverlayVariant = 'app' | 'viewport' | 'panel';

export interface LoadingOverlayProps {
  readonly variant: LoadingOverlayVariant;
  readonly visible?: boolean;
  readonly labelKey?: string;
}

const LABEL_KEYS: Record<LoadingOverlayVariant, string> = {
  app: 'common.loading.app',
  viewport: 'common.loading.viewport',
  panel: 'common.loading.panel',
};

export function LoadingOverlay({ variant, visible, labelKey }: LoadingOverlayProps) {
  const autoVisible = useUiStore(selectIsGloballyLoading); // variant='app' 만 의미
  const isVisible = variant === 'app' ? (visible ?? autoVisible) : (visible ?? false);
  const { t } = useTranslation('common');

  if (!isVisible) return null;

  return (
    <div
      role={variant === 'app' ? 'alert' : undefined}
      aria-busy="true"
      className={clsx(
        'flex items-center justify-center',
        variant === 'app'
          ? 'fixed inset-0 z-40 bg-bg-canvas/80'
          : 'absolute inset-0 bg-bg-panel/60',
      )}
    >
      <Spinner size="lg" />
      <VisuallyHidden>{t(labelKey ?? LABEL_KEYS[variant])}</VisuallyHidden>
    </div>
  );
}
