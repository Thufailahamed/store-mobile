import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/** Refetch company HQ data when orders, routes, inventory, or members change.
 *  Channel name is deterministic so rapid remounts re-attach to the same
 *  server-side subscription (Supabase treats identical channel names as the
 *  same channel for cleanup purposes), avoiding listener pile-up. */
export function useCompanyRealtime(
  companyId: string | undefined | null,
  userId: string | undefined,
  onUpdate: () => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!companyId || !userId) return;

    // 200ms debounce: a bulk dispatch emits N route_stop UPDATE events in a
    // burst; without debouncing we'd refetch N times and the later fetches
    // could resolve before earlier ones, overwriting fresh data with stale.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onUpdateRef.current();
      }, 200);
    };

    const channel = supabase
      .channel(`company-${userId}-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_company_id=eq.${companyId}` },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_routes", filter: `company_id=eq.${companyId}` },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "route_stops" },
        debounced,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_company_members",
          filter: `company_id=eq.${companyId}`,
        },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_inventory" },
        debounced,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [companyId, userId]);
}