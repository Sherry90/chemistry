// Phase 11 §6.7 / D-TOAST-VISUAL — phase-10 placeholder <ToastSlot> 교체.
// level 별 색/아이콘, 자동 dismiss, exit fade(150ms 지연 unmount). live region
// 은 per-item 단독 소유 (phase-10 ToastContainer 는 plain wrapper, D7).
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores';
import type { Notification } from '@/stores';
import { Info, CheckCircle, AlertTriangle, XCircle, X, type LucideIcon } from 'lucide-react';
import { cn } from '../_shared/cn';

export interface ToastItemProps {
  readonly notification: Notification;
}

const LEVEL_STYLE: Record<
  Notification['level'],
  {
    readonly bar: string;
    readonly icon: LucideIcon;
    readonly tone: string;
  }
> = {
  info: { bar: 'bg-accent', icon: Info, tone: 'text-accent' },
  success: { bar: 'bg-success', icon: CheckCircle, tone: 'text-success' },
  warn: { bar: 'bg-warn', icon: AlertTriangle, tone: 'text-warn' },
  error: { bar: 'bg-error', icon: XCircle, tone: 'text-error' },
};

export function ToastItem({ notification }: ToastItemProps): React.ReactElement {
  const { t } = useTranslation();
  const dismiss = useUiStore((s) => s.actions.dismissNotification);
  const [exiting, setExiting] = useState(false);
  const { bar, icon: Icon, tone } = LEVEL_STYLE[notification.level];
  const urgent = notification.level === 'error' || notification.level === 'warn';

  const onDismiss = (): void => {
    setExiting(true);
    setTimeout(() => dismiss(notification.id), 150);
  };

  useEffect(() => {
    if (notification.dismissAfterMs == null) return;
    const tid = setTimeout(onDismiss, notification.dismissAfterMs);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.dismissAfterMs, notification.id]);

  // messageKey 규약: i18next 완전수식 'ns:key' (예: 'panels:toolbar...',
  // 'shortcuts.bondCreate.diffMolecule' = common.shortcuts.*). default t 가
  // nsSeparator ':' 로 ns 선택 (§6.7).
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex items-center gap-3 overflow-hidden rounded-md border border-border bg-bg-panel-elevated shadow-md transition-all duration-200',
        exiting ? 'opacity-0' : 'translate-y-0 opacity-100',
      )}
      style={{ minWidth: '20rem' }}
    >
      <div className={cn('w-1 self-stretch', bar)} />
      <Icon size={18} aria-hidden className={tone} />
      <span className="flex-1 py-3 text-sm text-fg-primary">
        {notification.messageParams
          ? t(notification.messageKey, notification.messageParams)
          : t(notification.messageKey)}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('panels:toast.dismiss')}
        className="p-2 text-fg-muted hover:text-fg-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}
