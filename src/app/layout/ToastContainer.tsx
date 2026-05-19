// Phase 10 §6.8 / D7 / P9 + Phase 11 §6.8 retrofit — 큐 구독 + 위치 plain
// wrapper (live region 아님 — 발화는 Phase 11 <ToastItem> 단독, 중첩 방지).
// placeholder <ToastSlot> 를 <ToastItem> (@/panels) 로 교체. 큐 상한 50 store 보장.
import { useUiStore, selectNotifications } from '@/stores';
import { ToastItem } from '@/panels';

export function ToastContainer() {
  const notifications = useUiStore(selectNotifications);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}
