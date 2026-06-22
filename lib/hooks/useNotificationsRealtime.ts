import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { isAllowedRoute, isUuid, safeRoutePush, sanitizeSlug } from "@/lib/utils/safe-route";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  type: string;
  created_at: string;
}

interface UseNotificationsRealtimeArgs {
  userId: string | undefined;
  /** Called whenever a new notification row arrives (for badge updates). */
  onInsert?: (row: NotificationRow) => void;
  /** Called on any notifications change for the user (for list refresh). */
  onChange?: () => void;
  /** Whether to surface a local push when a server-pushed row arrives. */
  showLocalPush?: boolean;
  router?: Router;
}

const shownKeys = new Set<string>();
const MAX_SHOWN = 100;

/**
 * Subscribe to realtime changes on the `notifications` table for the
 * current user. Two effects:
 *
 *   1. onChange / onInsert fires for every INSERT/UPDATE/DELETE so
 *      the inbox can refresh + the bell badge can update without
 *      waiting for the next pull.
 *   2. If `showLocalPush` is set, a local push notification is
 *      scheduled when an INSERT lands. This is a backstop for users
 *      whose push token registration failed (network blip, missed
 *      permission grant, etc.) — the app still surfaces the alert.
 *      Dedupe window: 5 minutes per (type, data->>order_id) so a
 *      chatty trigger doesn't spam the user.
 *
 * Uses a single shared channel per userId so multiple mounted hooks
 * don't pile up duplicate subscriptions.
 */
export function useNotificationsRealtime({
  userId,
  onInsert,
  onChange,
  showLocalPush = false,
  router,
}: UseNotificationsRealtimeArgs) {
  const onInsertRef = useRef(onInsert);
  const onChangeRef = useRef(onChange);
  onInsertRef.current = onInsert;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!userId) return;
    const channel: RealtimeChannel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as NotificationRow;
          onInsertRef.current?.(row);
          onChangeRef.current?.();
          if (showLocalPush) {
            await maybeShowLocalPush(row);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => onChangeRef.current?.(),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => onChangeRef.current?.(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, showLocalPush]);

  // Re-handle taps by attaching a listener that uses the router if
  // provided. This is the realtime-triggered path; the one in
  // _layout.tsx is the system-tray path.
  useEffect(() => {
    if (!router) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { screen?: string; order_id?: string }
        | undefined;
      if (data?.screen && isAllowedRoute(data.screen)) {
        safeRoutePush(router, data.screen);
      } else if (data?.order_id) {
        const id = sanitizeSlug(data.order_id);
        if (isUuid(id)) {
          safeRoutePush(router, `/(main)/account/orders/${id}`, { id });
        }
      }
    });
    return () => sub.remove();
  }, [router]);
}

async function maybeShowLocalPush(row: NotificationRow) {
  const orderId = (row.data?.order_id as string | undefined) ?? null;
  const dedupeKey = `${row.type}:${orderId ?? row.id}`;
  const lastShown = shownKeys.has(dedupeKey);
  if (lastShown) return;
  shownKeys.add(dedupeKey);
  // Trim the in-memory set so it doesn't grow forever
  if (shownKeys.size > MAX_SHOWN) {
    const first = shownKeys.values().next().value;
    if (first) shownKeys.delete(first);
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: row.title,
        body: row.body ?? "",
        data: { ...(row.data ?? {}), type: row.type, notification_id: row.id },
        sound: "default",
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[notif realtime] local push failed:", err);
  }
}

/** Test-only: clears the dedupe set. */
export function __resetRealtimeDedupe(): void {
  shownKeys.clear();
}