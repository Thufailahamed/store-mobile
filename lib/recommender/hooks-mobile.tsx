/**
 * React Native hooks for the recommender (mobile).
 *
 *   useTrackViewableItems(items, surface)
 *     Hook to wire FlatList `onViewableItemsChanged`. Fires a single
 *     product_impression per (product, surface) the first time the
 *     item becomes ≥50% visible. Returns `{ onViewableItemsChanged,
 *     viewabilityConfig }` — spread both onto the FlatList.
 *
 *   useTrackImpression(product, surface)
 *     Fire a single product_impression on screen focus + when the
 *     product ref mounts. Used for PDPs and hero cards.
 *
 *   useTrackView(product)
 *     Fire a `view` event once when the product becomes active. Mirrors
 *     web's useTrackView.
 *
 *   useTrackEvent()
 *     Stable callback to fire any RecommendationEvent.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  trackEvent,
  snapshotProduct,
  type RecommendationEvent,
} from "./events";
import { useAuth } from "@/lib/supabase/auth";
import type { Product } from "@/lib/types";

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 250,
} as const;

export interface ViewableItem<T> {
  item: T;
  key: string;
  index: number | null;
  isViewable: boolean;
  [k: string]: unknown;
}

export function useTrackEvent(): (event: RecommendationEvent) => void {
  const { user } = useAuth();
  return useCallback(
    (event: RecommendationEvent) => {
      trackEvent(user?.id ?? null, event);
    },
    [user?.id],
  );
}

export function useTrackView(product: Product | null | undefined): void {
  const { user } = useAuth();
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!product || !user?.id) return;
    if (lastId.current === product.id) return;
    lastId.current = product.id;
    trackEvent(user.id, {
      type: "view",
      t: Date.now(),
      product: snapshotProduct(product),
    });
  }, [product, user?.id]);
}

/**
 * Fire `product_impression` once per (product, surface) the first time
 * the PDP/hero card mounts. Uses focus effect so it fires each time
 * the screen comes into view.
 */
export function useTrackImpression(
  product: Product | null | undefined,
  surface: string,
  position?: number,
): void {
  const { user } = useAuth();
  const firedRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!product || !user?.id) return;
      const key = `${product.id}|${surface}`;
      if (firedRef.current === key) return;
      firedRef.current = key;
      trackEvent(user.id, {
        type: "product_impression",
        t: Date.now(),
        product: snapshotProduct(product),
        surface,
        position,
      });
      return () => {
        // Reset on blur so a future focus can re-fire for a different product.
        firedRef.current = null;
      };
    }, [product, user?.id, surface, position]),
  );
}

/**
 * Hook that wires FlatList `onViewableItemsChanged`. Fires a single
 * product_impression per (product.id, surface) the first time each item
 * becomes ≥50% visible.
 *
 * Usage:
 *   const viewable = useTrackViewableItems(products, "category_grid");
 *   <FlatList data={products} {...viewable} ... />
 */
export function useTrackViewableItems<T extends Product>(
  items: T[] | null | undefined,
  surface: string,
) {
  const { user } = useAuth();
  const firedRef = useRef<Set<string>>(new Set());

  // Reset the dedupe set when the surface or item list changes so a
  // refresh re-fires impressions for the new dataset.
  useEffect(() => {
    firedRef.current = new Set();
    return () => {
      firedRef.current.clear();
    };
  }, [surface, items]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewableItem<T>[]; changed: ViewableItem<T>[] }) => {
      if (!user?.id) return;
      for (const v of viewableItems) {
        const product = v.item;
        if (!product?.id) continue;
        const key = `${product.id}|${surface}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        trackEvent(user.id, {
          type: "product_impression",
          t: Date.now(),
          product: snapshotProduct(product),
          surface,
          position: v.index ?? undefined,
        });
      }
    },
  ).current;

  return {
    onViewableItemsChanged,
    viewabilityConfig: VIEWABILITY_CONFIG,
  };
}