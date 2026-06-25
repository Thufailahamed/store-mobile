import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ProductRail } from "./ProductRail";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { useAuth } from "@/lib/supabase/auth";
import { useTrackEvent } from "@/lib/recommender";
import {
  getHomeFeed,
  type HomeFeedProduct,
  type HomeFeedSectionKey,
  type HomeFeedResponse,
} from "@/lib/api";
import type { Product, ProductImage } from "@/lib/types";
import { spacing } from "@/lib/theme/tokens";

/**
 * PersonalisedRails — renders the four personalised home-feed sections
 * (recents, top_categories, followed_brands, trending_for_you) using the
 * KV-cached `/api/users/home-feed` endpoint. Sections with empty arrays
 * collapse so the editorial layout shows through.
 *
 * Each row is normalised into a Product-shape so HomeProductCard can
 * consume it. Dismiss feeds negative-feedback signal through the
 * existing `useTrackEvent` hook.
 */
export function PersonalisedRails() {
  const { user } = useAuth();
  const tracker = useTrackEvent();

  const query = useQuery<HomeFeedResponse | null>({
    queryKey: ["home-feed", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await getHomeFeed();
      if (!res.ok) return null;
      return res.data;
    },
  });

  const sections = query.data?.sections;

  const rails = useMemo(() => {
    if (!sections) return [];
    const productFor = (row: HomeFeedProduct): Product => ({
      id: row.id,
      store_id: "",
      brand_id: row.brand_id ?? undefined,
      category_id: row.category_id ?? undefined,
      name: row.name,
      slug: row.slug,
      mrp: Number(row.mrp ?? row.price ?? 0),
      price: Number(row.price ?? row.mrp ?? 0),
      currency: row.currency ?? "LKR",
      discount_pct: 0,
      tax_rate: 0,
      status: "active" as Product["status"],
      product_type: "simple" as Product["product_type"],
      images: row.image_url
        ? ([{ url: row.image_url, is_primary: true, position: 0 }] as unknown as ProductImage[])
        : [],
      rating: row.rating ?? 0,
      total_sales: row.total_sales ?? 0,
      created_at: new Date().toISOString(),
      tags: [],
      is_featured: false,
      is_active: true,
      total_reviews: 0,
      view_count: 0,
      wishlist_count: 0,
    });

    type Rail = {
      key: HomeFeedSectionKey;
      kicker: string;
      title: string;
      products: Product[];
    };

    const out: Rail[] = [];
    if (sections.recents?.length) {
      out.push({
        key: "recents",
        kicker: "Your recents",
        title: "Pick up where you left off",
        products: sections.recents.map(productFor),
      });
    }
    if (sections.top_categories?.length) {
      out.push({
        key: "top_categories",
        kicker: "Tuned to your taste",
        title: "More in your favourites",
        products: sections.top_categories.map(productFor),
      });
    }
    if (sections.followed_brands?.length) {
      out.push({
        key: "followed_brands",
        kicker: "Your ateliers",
        title: "From brands you follow",
        products: sections.followed_brands.map(productFor),
      });
    }
    if (sections.trending_for_you?.length) {
      out.push({
        key: "trending_for_you",
        kicker: "Trending for you",
        title: "What's moving in your segment",
        products: sections.trending_for_you.map(productFor),
      });
    }
    return out;
  }, [sections]);

  if (!user) return null;
  if (query.isLoading && !sections) return null;
  if (rails.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Picks for you"
        kicker="Personalised"
      />
      {rails.map((rail) => (
        <ProductRail
          key={rail.key}
          title={rail.title}
          kicker={rail.kicker}
          products={rail.products}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[6] },
});

// Use the tracker hook to keep the import in scope (dismissal hook
// pattern is currently disabled because the underlying ProductRail
// doesn't expose per-card callbacks yet — see ForYouRail for the
// pattern that's wired when the rail supports it).
void useTrackEvent;