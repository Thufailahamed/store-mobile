import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useCart, useWishlist } from "@/lib/stores";
import { refreshCartFromCatalog } from "@/lib/cart-validation";

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
  const cartItems = useCart((s) => s.items);
  const cartCouponCode = useCart((s) => s.couponCode);
  const wishlistItems = useWishlist((s) => s.items);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // Initial load when user signs in (or when user.id changes).
  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;

    // Sign-out: clear local state once when transitioning away from a signed-in user.
    if (!userId || !session) {
      if (lastUserIdRef.current !== null) {
        lastUserIdRef.current = null;
        useCart.getState().clear();
        useWishlist.getState().clear();
      }
      return;
    }

    // Same user → already loaded, skip.
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;

    // Fire-and-forget; errors are swallowed in the store.
    void useCart
      .getState()
      .loadFromServer(userId)
      .then(() => refreshCartFromCatalog());
    useWishlist.getState().loadFromServer(userId);
  }, [user?.id, session, loading]);

  // Debounced push whenever cart items / coupon change.
  const cartSnapshot = `${Object.keys(cartItems).length}|${cartCouponCode ?? ""}|${JSON.stringify(
    Object.fromEntries(
      Object.entries(cartItems).map(([k, v]) => [k, v.quantity, v.price])
    )
  )}`;

  useEffect(() => {
    if (!user?.id) return;
    if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    cartTimerRef.current = setTimeout(() => {
      useCart.getState().syncToServer(user.id);
    }, 800);
    return () => {
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSnapshot, user?.id]);

  // Debounced push whenever wishlist changes.
  const wishlistSnapshot = `${Object.keys(wishlistItems).length}|${Object.keys(wishlistItems).join(",")}`;
  useEffect(() => {
    if (!user?.id) return;
    if (wishlistTimerRef.current) clearTimeout(wishlistTimerRef.current);
    wishlistTimerRef.current = setTimeout(() => {
      useWishlist.getState().syncToServer(user.id);
    }, 800);
    return () => {
      if (wishlistTimerRef.current) clearTimeout(wishlistTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlistSnapshot, user?.id]);
}
