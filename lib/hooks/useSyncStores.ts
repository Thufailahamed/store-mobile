import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useCart, useWishlist } from "@/lib/stores";

/**
 * Bridges the local cart + wishlist stores to their server tables.
 *   • On login → load remote cart + wishlist into local stores.
 *   • On mutation → debounce-push local state back to the server.
 *   • On logout → clear local stores so a guest session starts clean.
 *
 * Safe to mount once near the root (e.g. inside RootLayoutNav).
 */
export function useSyncStores() {
  const { user, session, loading } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // Initial load when user signs in (or when user.id changes).
  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;

    // Sign-out: clear local state and stop syncing.
    if (!userId || !session) {
      lastUserIdRef.current = null;
      cart.clear();
      wishlist.clear();
      return;
    }

    // Same user → already loaded, skip.
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;

    // Fire-and-forget; errors are swallowed in the store.
    cart.loadFromServer(userId);
    wishlist.loadFromServer(userId);
  }, [user?.id, session, loading, cart, wishlist]);

  // Debounced push whenever cart items / coupon change.
  const cartSnapshot = `${Object.keys(cart.items).length}|${cart.couponCode ?? ""}|${JSON.stringify(
    Object.fromEntries(
      Object.entries(cart.items).map(([k, v]) => [k, v.quantity, v.price])
    )
  )}`;

  useEffect(() => {
    if (!user?.id) return;
    if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    cartTimerRef.current = setTimeout(() => {
      cart.syncToServer(user.id);
    }, 800);
    return () => {
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSnapshot, user?.id]);

  // Debounced push whenever wishlist changes.
  const wishlistSnapshot = `${Object.keys(wishlist.items).length}|${Object.keys(wishlist.items).join(",")}`;
  useEffect(() => {
    if (!user?.id) return;
    if (wishlistTimerRef.current) clearTimeout(wishlistTimerRef.current);
    wishlistTimerRef.current = setTimeout(() => {
      wishlist.syncToServer(user.id);
    }, 800);
    return () => {
      if (wishlistTimerRef.current) clearTimeout(wishlistTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlistSnapshot, user?.id]);
}
