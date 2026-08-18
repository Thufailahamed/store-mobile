import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { StorefrontConfig } from "@luxe/store-storefront";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

interface PublishedResponse {
  channel: "app";
  storeId: string;
  slug: string;
  status: "draft" | "published";
  config: StorefrontConfig | null;
  publishedAt: string | null;
  templateSlug: string | null;
}

/**
 * Published app-channel storefront config for a store slug.
 *
 * Refresh triggers:
 *
 *   1. Supabase Realtime on `stores` — the backend's `publish_storefront`
 *      RPC increments `stores.storefront_cache_version` on every publish
 *      (web or app channel). `stores` is in the `supabase_realtime`
 *      publication since migration 0059. We filter by slug and watch for
 *      `storefront_cache_version` changes. One subscription covers both
 *      channels — no need to also add `storefronts` to realtime.
 *
 *   2. AppState foreground — refetch when the user reopens the app, in
 *      case realtime was missed (background socket dropped, app killed,
 *      offline for a while).
 */
export function usePublishedConfig(slug: string) {
  const queryClient = useQueryClient();
  const queryKey = ["storefront", slug, "app", "published"] as const;

  const q = useQuery<PublishedResponse, Error>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/storefront/${slug}/app/published`);
      if (!res.ok) {
        throw new Error(`Failed to load storefront (${res.status})`);
      }
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error?.message ?? "Failed to load storefront");
      }
      return json.data as PublishedResponse;
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Realtime: invalidate whenever this store's cache version bumps.
  useEffect(() => {
    if (!slug) return;
    const channel = supabase
      .channel(`store-cache:${slug}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "stores",
          filter: `slug=eq.${slug}`,
        },
        (payload) => {
          const next = payload.new as {
            storefront_cache_version?: number;
          } | null;
          const prev = payload.old as {
            storefront_cache_version?: number;
          } | null;
          // Only refetch when the version actually changed. UPDATE events
          // fire on any column change; we only care about publish bumps.
          if (
            next?.storefront_cache_version != null &&
            next.storefront_cache_version !== prev?.storefront_cache_version
          ) {
            queryClient.invalidateQueries({ queryKey });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slug, queryClient]);

  // AppState: refetch on foreground transition.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        queryClient.invalidateQueries({ queryKey });
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  return q;
}