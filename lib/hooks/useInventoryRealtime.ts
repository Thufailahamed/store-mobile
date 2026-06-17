/**
 * Live inventory for product pages — subscribes to Supabase Realtime on `inventory`.
 * Read-only; server RPCs are the source of truth for stock mutations.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getAvailableStock } from "@/lib/inventory";
import type { Product, ProductVariant } from "@/lib/types";

export type StockLevel = "in_stock" | "low_stock" | "out_of_stock";

export interface VariantStock {
  variantId: string;
  quantity: number;
  reserved: number;
  available: number;
  level: StockLevel;
  updatedAt?: string;
}

export interface InventoryRealtimeState {
  byVariant: Map<string, VariantStock>;
  isConnected: boolean;
  lastEventAt: number | null;
  totalAvailable: number;
  aggregateLevel: StockLevel;
  refresh: () => Promise<void>;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function variantToStock(variant: ProductVariant, lowThreshold: number): VariantStock {
  const embedded = (variant as ProductVariant & {
    inventory?: Array<{ quantity?: number; reserved?: number }>;
  }).inventory?.[0];
  const quantity = Math.max(0, Number(embedded?.quantity ?? variant.stock ?? 0));
  const reserved = Math.max(0, Number(embedded?.reserved ?? 0));
  const available = embedded
    ? getAvailableStock(embedded, Math.max(0, Number(variant.stock ?? 0)))
    : Math.max(0, Number(variant.stock ?? 0));
  return {
    variantId: variant.id,
    quantity,
    reserved,
    available,
    level:
      available <= 0 ? "out_of_stock" : available <= lowThreshold ? "low_stock" : "in_stock",
  };
}

export function useInventoryRealtime(
  product: Product | null | undefined,
  options: { lowStockThreshold?: number; enabled?: boolean } = {},
): InventoryRealtimeState {
  const { lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD, enabled = true } = options;
  const variants = useMemo(() => product?.variants ?? [], [product?.variants]);
  const variantIdsKey = useMemo(() => variants.map((v) => v.id).sort().join("|"), [variants]);

  const seed = useMemo(() => {
    const m = new Map<string, VariantStock>();
    for (const v of variants) m.set(v.id, variantToStock(v, lowStockThreshold));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantIdsKey, lowStockThreshold]);

  const [byVariant, setByVariant] = useState<Map<string, VariantStock>>(seed);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    setByVariant(new Map(seed));
  }, [seed]);

  const refresh = useMemo(
    () => async (): Promise<void> => {
      if (!product || !variants.length) return;
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("variant_id, quantity, reserved, low_stock_threshold, updated_at")
          .in(
            "variant_id",
            variants.map((v) => v.id),
          );
        if (error || !data) return;
        setByVariant((prev) => {
          const next = new Map(prev);
          for (const row of data as Array<Record<string, unknown>>) {
            const id = row.variant_id as string;
            if (!next.has(id)) continue;
            const quantity = Math.max(0, Number(row.quantity) || 0);
            const reserved = Math.max(0, Number(row.reserved) || 0);
            const threshold = Number(row.low_stock_threshold) || lowStockThreshold;
            const available = getAvailableStock({ quantity, reserved }, 0);
            next.set(id, {
              variantId: id,
              quantity,
              reserved,
              available,
              level:
                available <= 0
                  ? "out_of_stock"
                  : available <= threshold
                    ? "low_stock"
                    : "in_stock",
              updatedAt: row.updated_at as string | undefined,
            });
          }
          return next;
        });
        setLastEventAt(Date.now());
      } catch {
        // offline — ignore
      }
    },
    [product, variants, lowStockThreshold],
  );

  useEffect(() => {
    if (!enabled || !product || !variants.length) return;

    const variantIds = variants.map((v) => v.id);
    const filter = `variant_id=in.(${variantIds.join(",")})`;
    const uniqueId = Math.random().toString(36).slice(2, 10);

    const channel = supabase
      .channel(`inventory:${product.id}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory", filter },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const row = payload?.new ?? payload?.old ?? null;
          if (!row || !row.variant_id) return;
          const id = row.variant_id as string;
          setByVariant((prev) => {
            const next = new Map(prev);
            const quantity = Math.max(0, Number(row.quantity) || 0);
            const reserved = Math.max(0, Number(row.reserved) || 0);
            const threshold = Number(row.low_stock_threshold) || lowStockThreshold;
            const available = getAvailableStock({ quantity, reserved }, 0);
            next.set(id, {
              variantId: id,
              quantity,
              reserved,
              available,
              level:
                available <= 0
                  ? "out_of_stock"
                  : available <= threshold
                    ? "low_stock"
                    : "in_stock",
              updatedAt: row.updated_at as string | undefined,
            });
            return next;
          });
          setLastEventAt(Date.now());
        },
      )
      .subscribe((status: string) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, variantIdsKey, enabled, lowStockThreshold]);

  let totalAvailable = 0;
  let aggregateLevel: StockLevel = "out_of_stock";
  for (const v of byVariant.values()) {
    totalAvailable += v.available;
    if (v.level === "out_of_stock") {
      if (aggregateLevel !== "out_of_stock") aggregateLevel = "out_of_stock";
    } else if (v.level === "low_stock") {
      if (aggregateLevel === "in_stock") aggregateLevel = "low_stock";
    } else if (aggregateLevel !== "low_stock") {
      aggregateLevel = "in_stock";
    }
  }
  if (byVariant.size === 0) aggregateLevel = "out_of_stock";

  return {
    byVariant,
    isConnected,
    lastEventAt,
    totalAvailable,
    aggregateLevel,
    refresh,
  };
}

export function getVariantStock(
  state: InventoryRealtimeState,
  variantId: string | null | undefined,
): VariantStock | null {
  if (!variantId) return null;
  return state.byVariant.get(variantId) ?? null;
}
