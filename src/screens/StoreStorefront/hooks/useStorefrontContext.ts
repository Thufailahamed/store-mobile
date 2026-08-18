import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { getStoreBySlug, getStoreProducts } from "@/lib/api/stores";
import type { Product, Store } from "@/lib/types";

interface StorefrontContext {
  store: Store | null;
  products: Product[];
  productsTotal: number;
}

/**
 * Lightweight products + store context for the storefront renderer.
 *
 * Fetches the first 30 products so renderer sections (hero/featured/product
 * grid) can render real data. The full product list (sortable, paginated)
 * is still owned by the route-level tab section below the renderer.
 *
 * Realtime: subscribes to `stores` table for this slug and invalidates both
 * the store and products queries when `storefront_cache_version` bumps.
 * The same trigger that invalidates the config in `usePublishedConfig`
 * (publish_storefront RPC) also drives this — a publish may swap which
 * products the renderer's sections reference, so we re-fetch to keep them
 * in sync. Same single subscription as the config hook could be shared
 * later if these grow; for now each hook owns its own channel.
 */
export function useStorefrontContext(slug: string) {
  const queryClient = useQueryClient();

  const storeQ = useQuery<Store | null>({
    queryKey: ["store-by-slug", slug],
    queryFn: async () => {
      const r = await getStoreBySlug(slug);
      return r.ok ? r.data : null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  const productsQ = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["store-products", slug, "newest", 30],
    queryFn: async () => {
      const r = await getStoreProducts(slug, { sort: "newest", limit: 30, offset: 0 });
      return r.ok ? r.data : { products: [], total: 0 };
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!slug) return;
    const channel = supabase
      .channel(`store-context:${slug}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "stores",
          filter: `slug=eq.${slug}`,
        },
        (payload) => {
          const next = payload.new as { storefront_cache_version?: number } | null;
          const prev = payload.old as { storefront_cache_version?: number } | null;
          if (
            next?.storefront_cache_version != null &&
            next.storefront_cache_version !== prev?.storefront_cache_version
          ) {
            void queryClient.invalidateQueries({ queryKey: ["store-by-slug", slug] });
            void queryClient.invalidateQueries({ queryKey: ["store-products", slug, "newest", 30] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slug, queryClient]);

  return {
    store: storeQ.data ?? null,
    products: productsQ.data?.products ?? [],
    productsTotal: productsQ.data?.total ?? 0,
    isLoading: storeQ.isLoading || productsQ.isLoading,
    error: storeQ.error ?? productsQ.error,
    refetch: () => {
      void storeQ.refetch();
      void productsQ.refetch();
    },
  };
}