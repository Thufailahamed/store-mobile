/**
 * Schedule a local push notification when a new order is assigned to the rider.
 * Re-uses the existing notification handler + deep-link wiring (data.order_id).
 *
 * Debounced: Supabase realtime may fire INSERT + UPDATE for the same row within
 * a few seconds. We only notify once per order id within NOTIFY_COOLDOWN_MS.
 */

import * as Notifications from "expo-notifications";

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
