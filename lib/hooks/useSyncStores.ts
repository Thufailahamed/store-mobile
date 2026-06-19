import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { useCart, useWishlist } from "@/lib/stores";
import { setCartClampNoticeHandler } from "@/lib/stores/cart-store";
import { refreshCartFromCatalog } from "@/lib/cart-validation";
import {
  cartItemsToReservations,
  releaseCartReservations,
  scheduleCartReservationSync,
  setCartReservationSyncErrorHandler,
} from "@/lib/inventory-reservations";

/**
 * Bridges the local cart + wishlist stores to their server tables.
 *   • On login → load remote cart + wishlist into local stores.
 *   • On mutation → debounce-push local state back to the server.
 *   • On logout → clear local stores so a guest session starts clean.
 *
 * Safe to mount once near the root (e.g. inside RootLayoutNav).
 */
export function useSyncStores() {
  const { toast } = useToast();
  const { user, session, loading } = useAuth();
  const cartItems = useCart((s) => s.items);
  const cartCouponCode = useCart((s) => s.couponCode);
  const cartHydrated = useCart((s) => s.hydrated);
  const wishlistItems = useWishlist((s) => s.items);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCartReservationSyncErrorHandler((message) => {
      toast("Could not reserve stock", "error");
      console.warn("[cart-reservations]", message);
    });
    setCartClampNoticeHandler((notice) => {
      const where = notice.variantLabel ? ` (${notice.variantLabel})` : "";
      toast(
        `Only ${notice.capped} available — added ${notice.capped} of ${notice.requested} for ${notice.productName}${where}.`,
        "info",
      );
    });
    return () => {
      setCartReservationSyncErrorHandler(null);
      setCartClampNoticeHandler(null);
    };
  }, [toast]);

  // Initial load when user signs in (or when user.id changes).
  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;

    // Sign-out: flush pending sync, then clear local state.
    if (!userId || !session) {
      if (lastUserIdRef.current !== null) {
        if (cartTimerRef.current) {
          clearTimeout(cartTimerRef.current);
          cartTimerRef.current = null;
        }
        if (wishlistTimerRef.current) {
          clearTimeout(wishlistTimerRef.current);
          wishlistTimerRef.current = null;
        }
        void (async () => {
          // If we are signed out (no active session), any server push will fail with RLS.
          // Discard the sync call and clean up local state immediately.
          await releaseCartReservations();
          lastUserIdRef.current = null;
          useCart.getState().clear();
          useWishlist.getState().clear();
        })();
      }
      return;
    }

    // Same user → already loaded, skip.
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;

    useCart.setState({ hydrated: false });
    void useCart
      .getState()
      .loadFromServer(userId)
      .then((loadResult) => {
        if (!loadResult.ok) {
          toast(loadResult.error, "error");
          return null;
        }
        if (loadResult.quantityConflicts && loadResult.quantityConflicts > 0) {
          toast("Your bag was updated to match saved quantities.", "info");
        }
        return refreshCartFromCatalog();
      })
      .then((result) => {
        if (!result) return;
        if (!result.ok) {
          toast(result.error, "error");
          return;
        }
        const { reconciliation } = result;
        if (reconciliation.remove.length > 0) {
          toast(
            `${reconciliation.remove.length} unavailable item${reconciliation.remove.length === 1 ? "" : "s"} removed from your bag`,
            "info",
          );
        }
      });
    useWishlist.getState().loadFromServer(userId);
  }, [user?.id, session, loading]);

  useEffect(() => {
    if (!user?.id) return;
    scheduleCartReservationSync(
      user.id,
      cartItemsToReservations(Object.values(cartItems)),
    );
  }, [user?.id, cartItems]);

  const cartSnapshot = `${Object.keys(cartItems).length}|${cartCouponCode ?? ""}|${JSON.stringify(
    Object.fromEntries(
      Object.entries(cartItems).map(([k, v]) => [k, v.quantity, v.price])
    )
  )}`;

  useEffect(() => {
    if (!user?.id || !cartHydrated) return;
    if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    cartTimerRef.current = setTimeout(() => {
      void useCart.getState().syncToServer(user.id).then((result) => {
        if (!result.ok) {
          toast(result.error, "error");
        }
      });
    }, 800);
    return () => {
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSnapshot, user?.id, cartHydrated]);

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
