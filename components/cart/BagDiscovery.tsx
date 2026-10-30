import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ProductRail } from "@/components/home/premium";
import {
  getForYouRail,
  getPairsWellWithRail,
  getRecentlyViewedRail,
  getFromWishlistRail,
} from "@/lib/recommender";
import type { Product } from "@/lib/types";

interface BagDiscoveryProps {
  userId: string | null;
  /** Hydrated products currently in the bag — anchors "complete the look". */
  cartProducts: Product[];
  wishlistIds: string[];
  /** Products already shown elsewhere on the screen (e.g. Buy It Again). */
  excludeIds?: string[];
  onSeeAll: (path: string) => void;
}

interface Rails {
  pairs: Product[];
  forYou: Product[];
  wishlist: Product[];
  recent: Product[];
}

const EMPTY: Rails = { pairs: [], forYou: [], wishlist: [], recent: [] };
const MIN_RAIL = 2;

/**
 * Personalised discovery rails under the bag: complete-the-look,
 * recommended-for-you, saved-for-later and recently-viewed. Each rail
 * soft-fails independently and products are de-duplicated across rails
 * (and against the bag itself) so the stack never repeats a piece.
 */
export function BagDiscovery({
  userId,
  cartProducts,
  wishlistIds,
  excludeIds = [],
  onSeeAll,
}: BagDiscoveryProps) {
  const [rails, setRails] = useState<Rails>(EMPTY);

  const anchor = cartProducts[0] ?? null;
  const cartKey = cartProducts.map((p) => p.id).join("|");
  const wishKey = wishlistIds.join("|");

  useEffect(() => {
    let cancelled = false;
    const cartIds = cartKey ? cartKey.split("|") : [];
    (async () => {
      const [pairs, forYou, wish, recent] = await Promise.all([
        anchor ? getPairsWellWithRail(userId, anchor, 10) : Promise.resolve(null),
        getForYouRail(userId, 14),
        wishlistIds.length > 0 ? getFromWishlistRail(userId, wishlistIds, 10) : Promise.resolve(null),
        getRecentlyViewedRail(userId, 10, cartIds),
      ]);
      if (cancelled) return;

      // De-dupe in display order so earlier, stronger rails keep their picks.
      const seen = new Set<string>([...cartIds, ...excludeIds]);
      const take = (list: Product[] | undefined, max: number) => {
        const out: Product[] = [];
        for (const p of list ?? []) {
          if (out.length >= max) break;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          out.push(p);
        }
        return out;
      };

      setRails({
        pairs: take(pairs?.ok ? pairs.data : [], 8),
        forYou: take(forYou.ok ? forYou.data.products : [], 10),
        wishlist: take(wish?.ok ? wish.data.wishlist : [], 8),
        recent: take(recent.ok ? recent.data : [], 8),
      });
    })().catch(() => {
      /* Discovery is a soft-fail block; leave rails empty on error. */
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cartKey, wishKey, anchor?.id, excludeIds.join("|")]);

  const sections = useMemo(
    () =>
      [
        rails.pairs.length >= MIN_RAIL && (
          <ProductRail
            key="pairs"
            kicker="Complete the look"
            title={anchor ? `Pairs with your ${shortName(anchor.name)}` : "Pairs beautifully"}
            products={rails.pairs}
            accent
            showSaleBadge
            onSeeAll={() => onSeeAll("/(main)/products")}
          />
        ),
        rails.forYou.length >= MIN_RAIL && (
          <ProductRail
            key="foryou"
            kicker="Curated for you"
            title="Recommended for you"
            products={rails.forYou}
            variant="feature"
            showSaleBadge
            onSeeAll={() => onSeeAll("/(main)/products")}
          />
        ),
        rails.wishlist.length >= 1 && (
          <ProductRail
            key="wishlist"
            kicker="From your wishlist"
            title="Still thinking it over?"
            products={rails.wishlist}
            showSaleBadge
            onSeeAll={() => onSeeAll("/(main)/wishlist")}
          />
        ),
        rails.recent.length >= MIN_RAIL && (
          <ProductRail
            key="recent"
            kicker="Pick up where you left off"
            title="Recently viewed"
            products={rails.recent}
            showSaleBadge
          />
        ),
      ].filter(Boolean),
    [rails, anchor, onSeeAll],
  );

  if (sections.length === 0) return null;
  return <View>{sections}</View>;
}

/** "Red Cotton T-Shirt" → "t-shirt"; keeps rail titles short. */
function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] ?? name).toLowerCase();
}
