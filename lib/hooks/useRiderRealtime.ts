import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { notifyNewAssignment } from "@/lib/notifications/assignments";

type RiderListener = () => void;

interface RiderSubscription {
  channel: RealtimeChannel;
  listeners: Set<RiderListener>;
}

const riderSubscriptions = new Map<string, RiderSubscription>();

function notifyRiderListeners(riderId: string) {
  const entry = riderSubscriptions.get(riderId);
  if (!entry) return;
  for (const listener of entry.listeners) listener();
}

function acquireRiderSubscription(riderId: string, listener: RiderListener) {
  let entry = riderSubscriptions.get(riderId);
  if (!entry) {
    const listeners = new Set<RiderListener>();
    const channel = supabase
      .channel(`rider-${riderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_person_id=eq.${riderId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            notifyNewAssignment(payload.new as Parameters<typeof notifyNewAssignment>[0]);
          }
          notifyRiderListeners(riderId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `pickup_driver_id=eq.${riderId}` },
        () => notifyRiderListeners(riderId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_pickups", filter: `delivery_person_id=eq.${riderId}` },
        () => notifyRiderListeners(riderId),
      )
      // Membership deactivation: when the rider's row flips to is_active=false
      // we kick the listener so screens can re-fetch and render the
      // "account suspended" panel added in (delivery)/_layout.tsx.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_company_members", filter: `user_id=eq.${riderId}` },
        (payload) => {
          const next = payload.new as { is_active?: boolean } | null;
          if (next && next.is_active === false) {
            notifyRiderListeners(riderId);
          }
        },
      )
      .subscribe();

    entry = { channel, listeners };
    riderSubscriptions.set(riderId, entry);
  }

  entry.listeners.add(listener);
  return () => {
    const current = riderSubscriptions.get(riderId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      void supabase.removeChannel(current.channel);
      riderSubscriptions.delete(riderId);
    }
  };
}

/** Refetch rider data when assigned orders or return pickups change. */
export function useRiderRealtime(riderId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!riderId) return;
    return acquireRiderSubscription(riderId, () => onUpdateRef.current());
  }, [riderId]);
}
