/**
 * React hooks for tracking recommendation events.
 *
 * - useTrackView(product): fires a "view" event with dwell time when the
 *   component unmounts (or after a max dwell cap).
 * - useTrackEvent(): returns a stable function for one-off events.
 *
 * All hooks are best-effort and never throw.
 */

import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/lib/supabase/auth";
import { trackEvent, snapshotProduct, type TrackedProduct } from "./events";
import type { Product } from "@/lib/types";

const MAX_DWELL_MS = 120_000;

/**
 * Track a "view" event for a product while this component is mounted.
 *
 * Fire-and-forget; never blocks. Uses AppState to cap dwell time when the
 * app goes to background.
 */
export function useTrackView(product: Product | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const startRef = useRef<number>(0);
  const snapshotRef = useRef<TrackedProduct | null>(null);
  const firedRef = useRef<boolean>(false);

  // (Re)start the timer whenever the product changes.
  useEffect(() => {
    if (!product) return;
    startRef.current = Date.now();
    snapshotRef.current = snapshotProduct(product);
    firedRef.current = false;

    return () => {
      // Fire on unmount / product change.
      if (firedRef.current || !snapshotRef.current) return;
      firedRef.current = true;
      const dwell = Math.min(MAX_DWELL_MS, Date.now() - startRef.current);
      trackEvent(userId, {
        type: "view",
        t: Date.now(),
        product: snapshotRef.current,
        dwellMs: dwell,
      });
    };
  }, [product?.id, userId]);

  // Also fire if the app is backgrounded with an open product.
  useEffect(() => {
    if (!product) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && snapshotRef.current && !firedRef.current) {
        firedRef.current = true;
        const dwell = Math.min(MAX_DWELL_MS, Date.now() - startRef.current);
        trackEvent(userId, {
          type: "view",
          t: Date.now(),
          product: snapshotRef.current,
          dwellMs: dwell,
        });
      }
    });
    return () => sub.remove();
  }, [product?.id, userId]);
}

/** Get a stable tracker bound to the current user. */
export function useTrackEvent() {
  const { user } = useAuth();
  return useMemo(() => {
    const userId = user?.id ?? null;
    return {
      /** Track a product view (manual, in addition to useTrackView). */
      viewProduct(product: Product, dwellMs?: number) {
        trackEvent(userId, {
          type: "view",
          t: Date.now(),
          product: snapshotProduct(product),
          dwellMs: Math.min(MAX_DWELL_MS, Math.max(0, dwellMs ?? 0)),
        });
      },
      wishlist(product: Product, action: "add" | "remove") {
        trackEvent(userId, {
          type: action === "add" ? "wishlist_add" : "wishlist_remove",
          t: Date.now(),
          product: snapshotProduct(product),
        });
      },
      cartAdd(product: Product) {
        trackEvent(userId, {
          type: "cart_add",
          t: Date.now(),
          product: snapshotProduct(product),
        });
      },
      purchase(product: Product, quantity: number) {
        trackEvent(userId, {
          type: "purchase",
          t: Date.now(),
          product: snapshotProduct(product),
          quantity: Math.max(1, Math.floor(quantity)),
        });
      },
      search(query: string, tokens: string[], resultCount: number) {
        trackEvent(userId, {
          type: "search",
          t: Date.now(),
          query: query.trim(),
          tokens,
          resultCount: Math.max(0, Math.floor(resultCount)),
        });
      },
      dismiss(product: Product, surface: string) {
        trackEvent(userId, {
          type: "dismiss",
          t: Date.now(),
          product: snapshotProduct(product),
          surface,
        });
      },
      notInterested(product: Product) {
        trackEvent(userId, {
          type: "not_interested",
          t: Date.now(),
          product: snapshotProduct(product),
        });
      },
      /** Fires a search event for a clicked suggestion (keyword row). */
      searchSuggestion(term: string, label: string) {
        trackEvent(userId, {
          type: "search",
          t: Date.now(),
          query: label,
          tokens: [label],
          resultCount: 0,
          surface: "suggestion",
        });
      },
      /** Fires a view event tagged with scan:source for analytics. */
      scan(source: "library" | "camera", queryId?: string) {
        trackEvent(userId, {
          type: "view",
          t: Date.now(),
          product: { id: queryId ?? `scan-${Date.now()}` },
          surface: `scan:${source}`,
        });
      },
    };
  }, [user?.id]);
}
