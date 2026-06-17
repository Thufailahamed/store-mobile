import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/** Refetch rider data when assigned orders or return pickups change. */
export function useRiderRealtime(riderId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!riderId) return;

    const channel = supabase
      .channel(`rider-${riderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `delivery_person_id=eq.${riderId}` },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `pickup_driver_id=eq.${riderId}` },
        () => onUpdateRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_pickups", filter: `delivery_person_id=eq.${riderId}` },
        () => onUpdateRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);
}
