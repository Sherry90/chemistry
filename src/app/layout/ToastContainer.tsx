// Phase 10 §6.8 / D7 / P9 — 큐 구독 + 위치 plain wrapper (live region 아님 —
// 발화는 Phase 11 <ToastItem> 단독). 큐 상한 50 은 store 보장 (P9).
import { useUiStore, selectNotifications } from '@/stores';
import type { Notification } from '@/stores';

/** Phase 11 <ToastItem> 으로 교체될 placeholder (외양 최소). */
function ToastSlot({ notification }: { readonly notification: Notification }) {
  const dismiss = useUiStore((s) => s.actions.dismissNotification);
  return (
    <div className="pointer-events-auto rounded-md border border-border bg-bg-panel-elevated p-3 text-sm shadow-md">
      <span className="text-fg-primary">{notification.messageKey}</span>
      <button
        type="button"
        onClick={() => dismiss(notification.id)}
        className="ml-2 text-fg-muted hover:text-fg-primary"
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const notifications = useUiStore(selectNotifications);
  // 외곽은 plain wrapper — live region 미부여 (중첩 방지). pointer-events-none
  // 컨테이너 + 자식만 auto.
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {notifications.map((n) => (
        <ToastSlot key={n.id} notification={n} />
      ))}
    </div>
  );
}
