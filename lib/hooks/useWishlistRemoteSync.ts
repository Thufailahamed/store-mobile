import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores/wishlist-store";
import { isRemoteSyncPullSuppressed } from "@/lib/remote-sync-guard";

const DEBOUNCE_MS = 400;
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function hasSupabaseEnv(): boolean {
  return Boolean(URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cross-device wishlist sync via wishlist_items Realtime + foreground pull. */
export function useWishlistRemoteSync(): void {
  const { user, session, loading } = useAuth();
  const wishlistHydrated = useWishlist((s) => s.hydrated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pullInFlightRef = useRef(false);

  const schedulePull = (userId: string) => {
    if (!wishlistHydrated || isRemoteSyncPullSuppressed()) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pullInFlightRef.current || isRemoteSyncPullSuppressed()) return;
      pullInFlightRef.current = true;
      void useWishlist
        .getState()
        .refreshFromServer(userId)
        .finally(() => {
          pullInFlightRef.current = false;
        });
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    if (loading || !user?.id || !session || !hasSupabaseEnv() || !wishlistHydrated) {
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

    const userId = user.id;
    const uniqueId = Math.random().toString(36).slice(2, 10);

    const channel = supabase
      .channel(`wishlist-remote:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlist_items" },
        () => schedulePull(userId),
      )
      .subscribe();

    channelRef.current = channel;

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") schedulePull(userId);
    };
    const appStateSub = AppState.addEventListener("change", onAppState);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      appStateSub.remove();
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channelRef.current = null;
    };
  }, [user?.id, session, loading, wishlistHydrated]);
}
