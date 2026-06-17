import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/** Refetch company HQ data when orders, routes, inventory, or members change. */
export function useCompanyRealtime(
  companyId: string | undefined | null,
  userId: string | undefined,
  onUpdate: () => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!companyId || !userId) return;

    const uniqueId = Math.random().toString(36).slice(2, 10);
    const channel = supabase
      .channel(`company-${userId}-${companyId}-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_company_id=eq.${companyId}` },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_routes", filter: `company_id=eq.${companyId}` },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "route_stops" },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_company_members",
          filter: `company_id=eq.${companyId}`,
        },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_inventory" },
        () => onUpdateRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, userId]);
}
