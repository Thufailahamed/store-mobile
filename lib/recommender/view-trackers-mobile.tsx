/**
 * Mobile view trackers (0260). Fire-on-mount React components that
 * record category_view / collection_view / store_view. Embed inside
 * RSC-equivalent route screens so the ranker learns which taxonomy
 * nodes a user browses.
 *
 * Mirrors web's `src/components/recommender/view-trackers.tsx`.
 */

import { useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { trackEvent } from "./events";
import { useAuth } from "@/lib/supabase/auth";

interface BaseProps {
  id: string | null | undefined;
}

export function CategoryViewTracker({ id }: BaseProps) {
  const { user } = useAuth();
  const firedRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      if (firedRef.current === id) return;
      firedRef.current = id;
      trackEvent(user?.id ?? null, {
        type: "category_view",
        t: Date.now(),
        category_id: id,
      });
      return () => {
        firedRef.current = null;
      };
    }, [id, user?.id]),
  );
  return null;
}

export function CollectionViewTracker({ id }: BaseProps) {
  const { user } = useAuth();
  const firedRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      if (firedRef.current === id) return;
      firedRef.current = id;
      trackEvent(user?.id ?? null, {
        type: "collection_view",
        t: Date.now(),
        collection_id: id,
      });
      return () => {
        firedRef.current = null;
      };
    }, [id, user?.id]),
  );
  return null;
}

export function StoreViewTracker({ id }: BaseProps) {
  const { user } = useAuth();
  const firedRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      if (firedRef.current === id) return;
      firedRef.current = id;
      trackEvent(user?.id ?? null, {
        type: "store_view",
        t: Date.now(),
        store_id: id,
      });
      return () => {
        firedRef.current = null;
      };
    }, [id, user?.id]),
  );
  return null;
}

/**
 * Fire `search` once when a search query runs. Embed in the search
 * screen's effect. Optional surface tag (e.g. "typeahead" vs "full").
 */
export function useTrackSearch(query: string, resultCount: number, surface = "full") {
  const { user } = useAuth();
  const lastQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const q = (query ?? "").trim();
    if (!q) return;
    if (lastQueryRef.current === q) return;
    lastQueryRef.current = q;
    const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
    trackEvent(user?.id ?? null, {
      type: "search",
      t: Date.now(),
      query: q,
      tokens,
      resultCount,
      surface,
    });
  }, [query, resultCount, surface, user?.id]);
}

/**
 * Fire `checkout_started` once per cart total. Embed in the checkout
 * payment-step screen.
 */
export function useTrackCheckoutStarted(cartTotal: number | undefined, itemCount: number | undefined) {
  const { user } = useAuth();
  const firedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      firedRef.current = false;
      return () => {
        firedRef.current = false;
      };
    }, []),
  );
  useEffect(() => {
    if (!user?.id) return;
    if (firedRef.current) return;
    if (typeof cartTotal !== "number" || cartTotal <= 0) return;
    firedRef.current = true;
    trackEvent(user.id, {
      type: "checkout_started",
      t: Date.now(),
      cart_total: cartTotal,
      item_count: itemCount,
    });
  }, [cartTotal, itemCount, user?.id]);
}