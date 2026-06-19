import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCart } from "@/lib/stores/cart-store";
import { refreshCartFromCatalog } from "@/lib/cart-validation";

const DEBOUNCE_MS = 400;

/**
 * useCartRealtime (mobile) — mirrors the web hook. Subscribes to
 * product / variant / inventory changes filtered by the store IDs in
 * the cart. Debounces 400 ms before calling refreshCartFromCatalog().
 *
 * No-op when the cart is empty or Supabase env vars are missing.
 */
export function useCartRealtime(): void {
  const items = useCart((s) => s.items);
  const storeIds = Array.from(
    new Set(
      Object.values(items ?? {})
        .map((it) => it.storeId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (storeIds.length === 0) {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          // ignore
        }
        channelRef.current = null;
      }
      return;
    }

    const storeFilter = `store_id=in.(${storeIds.join(",")})`;
    const uniqueId = Math.random().toString(36).slice(2, 10);

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void refreshCartFromCatalog();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`cart-mobile:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: storeFilter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants", filter: storeFilter },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        scheduleRefresh,
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channelRef.current = null;
    };
  }, [storeIds.join("|")]);
}