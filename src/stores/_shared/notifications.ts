// Phase 07 §9 R7 — 토스트 큐 무한 증가 방지.
// notify 후 길이가 상한을 넘으면 가장 오래된 항목부터 drop-oldest (FIFO 축출).
import type { Notification } from '../uiStore.types';

export const NOTIFICATION_QUEUE_MAX = 50;

/**
 * push 후 길이가 NOTIFICATION_QUEUE_MAX 를 초과하면 정확히 상한 개수만 유지하도록
 * 가장 오래된 초과분을 잘라낸 *새* 배열을 반환한다 (immer draft 안에서 재할당).
 */
export function clampNotifications(
  queue: ReadonlyArray<Notification>,
): ReadonlyArray<Notification> {
  if (queue.length <= NOTIFICATION_QUEUE_MAX) return queue;
  return queue.slice(queue.length - NOTIFICATION_QUEUE_MAX);
}
