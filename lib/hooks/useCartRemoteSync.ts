import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";
import { useCart } from "@/lib/stores/cart-store";
import { isRemoteSyncPullSuppressed } from "@/lib/remote-sync-guard";

const DEBOUNCE_MS = 400;
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function hasSupabaseEnv(): boolean {
  return Boolean(URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Keeps the bag in sync across web + app:
 *   • Supabase Realtime on cart_items (RLS-scoped to the signed-in user)
 *   • Pull from server when the app returns to the foreground
 */
export function useCartRemoteSync(): void {
  const { user, session, loading } = useAuth();
  const cartHydrated = useCart((s) => s.hydrated);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pullInFlightRef = useRef(false);

  const schedulePull = (userId: string) => {
    if (!cartHydrated || isRemoteSyncPullSuppressed()) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pullInFlightRef.current || isRemoteSyncPullSuppressed()) return;
      pullInFlightRef.current = true;
      void useCart
        .getState()
        .refreshFromServer(userId)
        .finally(() => {
          pullInFlightRef.current = false;
        });
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    if (loading || !user?.id || !session || !hasSupabaseEnv() || !cartHydrated) {
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
      .channel(`cart-remote:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
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
  }, [user?.id, session, loading, cartHydrated]);
}
