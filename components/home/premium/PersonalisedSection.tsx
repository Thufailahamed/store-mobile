import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { HomeProductCard } from "./HomeProductCard";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { useTrackEvent } from "@/lib/recommender";
import {
  getHomeFeed,
  mapFlatProductRows,
  type HomeFeedProduct,
  type HomeFeedSectionKey,
  type HomeFeedResponse,
} from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductImage } from "@/lib/types";

function productImage(product: Product) {
  return product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
}

function WishlistHeart({ product, size = 14 }: { product: Product; size?: number }) {
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggle = useWishlist((s) => s.toggle);
  const tracker = useTrackEvent();
  return (
    <TouchableOpacity
      style={styles.heartBtn}
      onPress={() => {
        tracker.wishlist(product, isWishlisted ? "remove" : "add");
        toggle(product.id);
      }}
      activeOpacity={0.75}
      hitSlop={8}
    >
      <Ionicons
        name={isWishlisted ? "heart" : "heart-outline"}
        size={size}
        color={isWishlisted ? colors.light.destructive : colors.light.foreground}
      />
    </TouchableOpacity>
  );
}

interface PersonalisedSectionProps {
  title: string;
  products: Product[];
  hasSignal?: boolean;
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onSeeAll?: () => void;
}

/**
 * One editorial panel for everything that used to be three stacked,
 * near-identical "recommended for you" sections (ForYouRail,
 * PersonalisedRails, RecommendedForYouRail). The `["home-feed", user.id]`
 * query and productFor mapping below are unchanged from those components —
 * this is a presentational merge, not a data change.
 */
export function PersonalisedSection({
  title,
  products,
  hasSignal = true,
  loading = false,
  onRefresh,
  onSeeAll,
}: PersonalisedSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const tracker = useTrackEvent();
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = products.filter((p) => !hidden.has(p.id));
  const [heroProduct, ...restVisible] = visible;
  const gridSmalls = restVisible.slice(0, 2);
  const moreProducts = restVisible.slice(2);

  const homeFeedQuery = useQuery<HomeFeedResponse | null>({
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

  const sections = homeFeedQuery.data?.sections;

  const subRails = useMemo(() => {
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

    type SubRail = { key: HomeFeedSectionKey; label: string; products: Product[] };

    const out: SubRail[] = [];
    if (sections.recents?.length) {
      out.push({
        key: "recents",
        label: "Pick up where you left off",
        products: sections.recents.map(productFor),
      });
    }
    if (sections.top_categories?.length) {
      out.push({
        key: "top_categories",
        label: "More in your favourites",
        products: sections.top_categories.map(productFor),
      });
    }
    if (sections.followed_brands?.length) {
      out.push({
        key: "followed_brands",
        label: "From brands you follow",
        products: sections.followed_brands.map(productFor),
      });
    }
    if (sections.trending_for_you?.length) {
      out.push({
        key: "trending_for_you",
        label: "Picked for your style",
        products: mapFlatProductRows(sections.trending_for_you),
      });
    }
    return out;
  }, [sections]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleDismiss = useCallback(
    (product: Product) => {
      setHidden((prev) => new Set(prev).add(product.id));
      tracker.dismiss(product, "for_you_rail");
    },
    [tracker],
  );

  const handleNotInterested = useCallback(
    (product: Product) => {
      setHidden((prev) => new Set(prev).add(product.id));
      tracker.notInterested(product);
      Alert.alert("Got it", "We'll show fewer items like this.");
    },
    [tracker],
  );

  if (!user) return null;
  if (visible.length === 0 && subRails.length === 0 && !loading) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <View style={styles.kickerRow}>
            {hasSignal ? (
              <View style={styles.dotAccent} />
            ) : (
              <Ionicons name="sparkles-outline" size={11} color={colors.olive[600]} />
            )}
            <Text style={styles.kickerText}>
              {hasSignal ? "CURATED FOR YOU" : "TRENDING IN THE EDIT"}
            </Text>
          </View>
          <Text style={[styles.title, hasSignal && styles.titleAccent]}>{title}</Text>
        </View>
        {onRefresh ? (
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={refreshing}
            hitSlop={10}
            style={styles.refreshBtn}
            accessibilityLabel="Refresh recommendations"
          >
            <Ionicons
              name="refresh"
              size={14}
              color={colors.light.mutedForeground}
              style={refreshing ? styles.spin : undefined}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && visible.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.olive[600]} />
        </View>
      ) : heroProduct ? (
        <>
          <View style={styles.grid}>
            <TouchableOpacity
              style={styles.heroCard}
              activeOpacity={0.9}
              onPress={() => router.push(`/(main)/products/${heroProduct.slug}`)}
            >
              {productImage(heroProduct) ? (
                <Image
                  source={{ uri: productImage(heroProduct) }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
              )}
              <LinearGradient
                colors={["transparent", "rgba(10,9,8,0.72)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDismiss(heroProduct)}
                  hitSlop={6}
                  accessibilityLabel="Dismiss"
                >
                  <Ionicons name="close" size={12} color={colors.light.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleNotInterested(heroProduct)}
                  hitSlop={6}
                  accessibilityLabel="Not interested"
                >
                  <Ionicons name="thumbs-down-outline" size={12} color={colors.light.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.heroHeart}>
                <WishlistHeart product={heroProduct} size={15} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroName} numberOfLines={2}>
                  {heroProduct.name}
                </Text>
                <Text style={styles.heroPrice}>
                  {heroProduct.price ? formatPrice(heroProduct.price) : "Price on request"}
                </Text>
              </View>
            </TouchableOpacity>

            {gridSmalls.length > 0 ? (
              <View style={styles.gridSmallCol}>
                {gridSmalls.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.smallCard}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/(main)/products/${p.slug}`)}
                  >
                    {productImage(p) ? (
                      <Image
                        source={{ uri: productImage(p) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
                    )}
                    <View style={styles.smallHeart}>
                      <WishlistHeart product={p} size={13} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          {gridSmalls.length > 0 ? (
            <View style={styles.captionRow}>
              {gridSmalls.map((p) => (
                <Text key={p.id} style={styles.captionText} numberOfLines={1}>
                  {p.name} — {p.price ? formatPrice(p.price) : "Price on request"}
                </Text>
              ))}
            </View>
          ) : null}

          {moreProducts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, styles.moreScroll]}
            >
              {moreProducts.map((p, i) => (
                <HomeProductCard key={p.id} product={p} index={i} />
              ))}
            </ScrollView>
          ) : null}

          {onSeeAll ? (
            <TouchableOpacity style={styles.seeAllLink} onPress={onSeeAll} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all recommendations</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.light.primary} />
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {subRails.map((rail, railIndex) => (
        <View
          key={rail.key}
          style={[styles.subRail, railIndex === 0 && (visible.length > 0 || loading) && styles.subRailDivider]}
        >
          <Text style={styles.subLabel}>{rail.label}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {rail.products.slice(0, 10).map((p, i) => (
              <HomeProductCard key={p.id} product={p} index={i} />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[8],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    backgroundColor: colors.olive[50],
    borderRadius: radii["2xl"],
    ...shadows.soft,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dotAccent: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.olive[600],
  },
  kickerText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  titleAccent: {
    color: colors.light.primary,
  },
  refreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  spin: {
    transform: [{ rotate: "180deg" }],
  },
  loading: {
    paddingVertical: spacing[8],
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  moreScroll: {
    marginTop: spacing[4],
  },
  actionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },
  heroCard: {
    flex: 1.15,
    height: 300,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
  },
  heroPlaceholder: {
    backgroundColor: colors.olive[100],
  },
  heroActions: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    gap: 4,
  },
  heroHeart: {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
  },
  heroCopy: {
    position: "absolute",
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
  },
  heroName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.light.card,
  },
  heroPrice: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: "#e9e2d4",
    marginTop: 2,
  },
  gridSmallCol: {
    flex: 1,
    gap: spacing[3],
  },
  smallCard: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
  },
  smallHeart: {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
  },
  captionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
  },
  captionText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  seeAllLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[4],
  },
  seeAllText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.primary,
  },
  subRail: {
    marginTop: spacing[4],
  },
  subRailDivider: {
    paddingTop: spacing[4],
    marginTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  subLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
  },
});
