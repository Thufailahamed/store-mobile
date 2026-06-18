/**
 * Schedule a local push notification when a new order is assigned to the rider.
 * Re-uses the existing notification handler + deep-link wiring (data.order_id).
 *
 * Debounced: Supabase realtime may fire INSERT + UPDATE for the same row within
 * a few seconds. We only notify once per order id within NOTIFY_COOLDOWN_MS.
 *
 * `notifyDeliveryFailure` mirrors the same debounce + deep-link wiring for
 * the buyer-side failure notification. It's mobile-only — the server is the
 * authority on whether to actually email/push the buyer; this hook is a
 * rider-side confirmation that the failure was recorded and the buyer has
 * been notified upstream.
 */

import * as Notifications from "expo-notifications";
import {
  ISSUE_REASON_BY_VALUE,
  type IssueReason,
} from "@/lib/utils/delivery-format";

const NOTIFY_COOLDOWN_MS = 60_000;

interface AssignmentRow {
  id: string;
  order_number?: string | null;
  status: string;
}

const lastNotified = new Map<string, number>();

export function notifyNewAssignment(order: AssignmentRow) {
  const now = Date.now();
  const last = lastNotified.get(order.id) ?? 0;
  if (now - last < NOTIFY_COOLDOWN_MS) return;
  lastNotified.set(order.id, now);

  // Fire-and-forget; failures are silent.
  void Notifications.scheduleNotificationAsync({
    content: {
      title: "New delivery assigned",
      body: order.order_number ? `Order ${order.order_number}` : "Tap to view details",
      data: { order_id: order.id, screen: `/(delivery)/orders/${order.id}` },
      sound: "default",
    },
    trigger: null,
  });
}

/**
 * Rider-side confirmation that a delivery failure was recorded and the
 * buyer will be notified upstream. Uses a separate cooldown key
 * ("fail:{order.id}") so it doesn't collide with `notifyNewAssignment`.
 */
export function notifyDeliveryFailure(
  order: AssignmentRow,
  reason: IssueReason,
): Promise<void> {
  const key = `fail:${order.id}`;
  const now = Date.now();
  const last = lastNotified.get(key) ?? 0;
  if (now - last < NOTIFY_COOLDOWN_MS) {
    return Promise.resolve();
  }
  lastNotified.set(key, now);
  const label = ISSUE_REASON_BY_VALUE[reason]?.label ?? reason;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Delivery attempt failed",
      body: `${order.order_number ?? "Order"} — ${label}. Buyer has been notified.`,
      data: { order_id: order.id, screen: `/(delivery)/orders/${order.id}` },
      sound: "default",
    },
    trigger: null,
  }).then(() => undefined);
}

/** Test-only: clears the in-memory debounce map. */
export function __resetNotifyDebounceForTests(): void {
  lastNotified.clear();
}
