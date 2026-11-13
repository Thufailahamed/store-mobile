import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { useWishlist } from "@/lib/stores";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";
import { getSimilarProducts, getYouMayAlsoLike } from "@/lib/recommender";
import { getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";

export type TabKey = "all" | "similar" | "favourites";

interface TabOption {
  key: TabKey;
  label: string;
}

const TABS: TabOption[] = [
  { key: "all", label: "All" },
  { key: "similar", label: "Similar" },
  { key: "favourites", label: "Your Next Favourites" },
];

const PAGE_SIZE = 10;

interface InfiniteRecommendedFeedProps {
  currentProduct: Product;
  userId?: string | null;
  onRegisterLoadMore?: (loadMoreFn: () => void) => void;
}

export function InfiniteRecommendedFeed({
  currentProduct,
  userId,
  onRegisterLoadMore,
}: InfiniteRecommendedFeedProps) {
  const { width: screenWidth } = useWindowDimensions();
  // 2-column calculation matching 16px horizontal screen padding and 12px inter-card gap
  const cardWidth = Math.floor((screenWidth - 32 - 12) / 2);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [itemsByTab, setItemsByTab] = useState<Record<TabKey, Product[]>>({
    all: [],
    similar: [],
    favourites: [],
  });
  const [offsetByTab, setOffsetByTab] = useState<Record<TabKey, number>>({
    all: 0,
    similar: 0,
    favourites: 0,
  });
  const [hasMoreByTab, setHasMoreByTab] = useState<Record<TabKey, boolean>>({
    all: true,
    similar: true,
    favourites: true,
  });
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentItems = itemsByTab[activeTab];
  const currentHasMore = hasMoreByTab[activeTab];

  // Load initial batch for a tab
  const loadTabInitial = useCallback(
    async (tab: TabKey) => {
      setLoadingInitial(true);
      const seenIds = new Set<string>([currentProduct.id]);
      const collected: Product[] = [];

      try {
        if (tab === "similar") {
          const simRes = await getSimilarProducts(currentProduct, 12);
          if (simRes.ok && simRes.data) {
            for (const p of simRes.data) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
          // Fetch more from same category if needed
          if (collected.length < PAGE_SIZE && currentProduct.category?.slug) {
            const catRes = await getProducts({
              categorySlug: currentProduct.category.slug,
              gender: currentProduct.gender || undefined,
              limit: PAGE_SIZE,
              offset: 0,
            });
            if (catRes.ok && catRes.data?.products) {
              for (const p of catRes.data.products) {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  collected.push(p);
                }
              }
            }
          }
        } else if (tab === "favourites") {
          const ymalRes = await getYouMayAlsoLike(userId ?? null, currentProduct, 12);
          if (ymalRes.ok && ymalRes.data) {
            for (const p of ymalRes.data) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
          if (collected.length < PAGE_SIZE) {
            const topRes = await getProducts({
              sort: "rating",
              limit: PAGE_SIZE,
              offset: 0,
            });
            if (topRes.ok && topRes.data?.products) {
              for (const p of topRes.data.products) {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  collected.push(p);
                }
              }
            }
          }
        } else {
          // "all" - blend similar, favorites and fresh catalog items
          const [simRes, ymalRes, catRes] = await Promise.all([
            getSimilarProducts(currentProduct, 8),
            getYouMayAlsoLike(userId ?? null, currentProduct, 8),
            getProducts({
              categorySlug: currentProduct.category?.slug,
              limit: 8,
              offset: 0,
            }),
          ]);

          const pools = [
            simRes.ok ? simRes.data : [],
            ymalRes.ok ? ymalRes.data : [],
            catRes.ok ? catRes.data.products : [],
          ];

          // Interleave products from the pools
          const maxLen = Math.max(...pools.map((p) => p.length));
          for (let i = 0; i < maxLen; i++) {
            for (const pool of pools) {
              const p = pool[i];
              if (p && !seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
        }

        setItemsByTab((prev) => ({ ...prev, [tab]: collected }));
        setOffsetByTab((prev) => ({ ...prev, [tab]: collected.length }));
        setHasMoreByTab((prev) => ({ ...prev, [tab]: collected.length >= 6 }));
      } catch (e) {
        console.error("Failed to load recommendations for tab:", tab, e);
      } finally {
        setLoadingInitial(false);
      }
    },
    [currentProduct, userId],
  );

  // Trigger initial fetch when activeTab changes if not already loaded
  useEffect(() => {
    if (itemsByTab[activeTab].length === 0) {
      void loadTabInitial(activeTab);
    }
  }, [activeTab, itemsByTab, loadTabInitial]);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingInitial || loadingMore || !hasMoreByTab[activeTab]) return;

    setLoadingMore(true);
    const currentOffset = offsetByTab[activeTab];
    const existing = itemsByTab[activeTab];
    const seenIds = new Set<string>([currentProduct.id, ...existing.map((p) => p.id)]);

    try {
      let nextProducts: Product[] = [];
      if (activeTab === "similar") {
        const res = await getProducts({
          categorySlug: currentProduct.category?.slug,
          gender: currentProduct.gender || undefined,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      } else if (activeTab === "favourites") {
        const res = await getProducts({
          sort: "rating",
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      } else {
        const res = await getProducts({
          sort: "newest",
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      }

      const fresh = nextProducts.filter((p) => !seenIds.has(p.id));

      if (fresh.length === 0) {
        setHasMoreByTab((prev) => ({ ...prev, [activeTab]: false }));
      } else {
        setItemsByTab((prev) => ({
          ...prev,
          [activeTab]: [...prev[activeTab], ...fresh],
        }));
        setOffsetByTab((prev) => ({
          ...prev,
          [activeTab]: currentOffset + nextProducts.length,
        }));
      }
    } catch (e) {
      console.error("Failed to load more recommendations:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeTab,
    currentProduct,
    hasMoreByTab,
    itemsByTab,
    loadingInitial,
    loadingMore,
    offsetByTab,
  ]);

  // Register loadMore with the parent ScrollView
  useEffect(() => {
    onRegisterLoadMore?.(loadMore);
  }, [loadMore, onRegisterLoadMore]);

  if (!loadingInitial && currentItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* ── Section Title ────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Products you may like</Text>

      {/* ── Filter Pills / Tabs ─────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillInactive]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  isActive ? styles.tabPillTextActive : styles.tabPillTextInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── 2-Column Product Grid ────────────────────────────────── */}
      {loadingInitial ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((n) => (
            <View key={n} style={[styles.skeletonCard, { width: cardWidth }]}>
              <View style={[styles.skeletonImage, { height: cardWidth * 1.33 }]} />
              <View style={styles.skeletonLineShort} />
              <View style={styles.skeletonLineLong} />
              <View style={styles.skeletonLinePrice} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {currentItems.map((prod) => (
            <RecommendedProductCard key={prod.id} product={prod} cardWidth={cardWidth} />
          ))}
        </View>
      )}

      {/* ── Bottom Infinite Spinner or End Marker ────────────────── */}
      {loadingMore && (
        <View style={styles.loadingMoreWrap}>
          <ActivityIndicator size="small" color="#e11d48" />
          <Text style={styles.loadingMoreText}>Discovering more pieces…</Text>
        </View>
      )}

      {!currentHasMore && currentItems.length > 0 && !loadingMore && (
        <View style={styles.endCapWrap}>
          <View style={styles.endCapLine} />
          <Text style={styles.endCapText}>YOU’VE VIEWED ALL RECOMMENDATIONS</Text>
          <View style={styles.endCapLine} />
        </View>
      )}
    </View>
  );
}

// ── Myntra-style High Fashion Recommendation Card ────────────────
function RecommendedProductCard({
  product,
  cardWidth,
}: {
  product: Product;
  cardWidth: number;
}) {
  const router = useRouter();
  const toggleWishlist = useWishlistToggle();
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);

  const primaryImage =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const imageHeight = Math.round(cardWidth * 1.33);

  const brandName =
    product.brand?.name?.toUpperCase() ||
    product.store?.name?.toUpperCase() ||
    "VESTARA";

  const discount =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : (product.discount_pct ?? 0);

  // Best Price with offer (extra 8% coupon promo)
  const bestPrice =
    product.price > 0 ? Math.round(product.price * 0.92) : product.price;

  const handlePress = () => {
    router.push(`/(main)/products/${product.slug}`);
  };

  const handleWishlistPress = (e: any) => {
    e.stopPropagation?.();
    toggleWishlist(product, primaryImage);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={handlePress}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* ── Image with rounded corners ──────────────────────────── */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={28} color={colors.light.mutedForeground} />
          </View>
        )}
      </View>

      {/* ── Card Content ────────────────────────────────────────── */}
      <View style={styles.infoContainer}>
        {/* Row 1: Brand name bold (left) + Heart outline/filled (right) */}
        <View style={styles.brandRow}>
          <Text style={styles.brandName} numberOfLines={1}>
            {brandName}
          </Text>
          <TouchableOpacity
            onPress={handleWishlistPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.heartButton}
            accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={18}
              color={isWishlisted ? "#e11d48" : "#222222"}
            />
          </TouchableOpacity>
        </View>

        {/* Row 2: Product Name / Title */}
        <Text style={styles.productTitle} numberOfLines={1}>
          {product.name}
        </Text>

        {/* Row 3: Strikethrough MRP + Bold Price + % OFF in vibrant orange */}
        <View style={styles.priceRow}>
          {discount > 0 && product.mrp && product.mrp > product.price ? (
            <Text style={styles.mrpText} numberOfLines={1}>
              {formatPrice(product.mrp, product.currency || "LKR")}
            </Text>
          ) : null}
          <Text style={styles.priceText} numberOfLines={1}>
            {formatPrice(product.price, product.currency || "LKR")}
          </Text>
          {discount > 0 ? (
            <Text style={styles.discountText} numberOfLines={1}>
              {discount}% OFF
            </Text>
          ) : null}
        </View>

        {/* Row 4: Best Price with offer */}
        {product.price > 0 ? (
          <Text style={styles.offerText} numberOfLines={1}>
            Best Price {formatPrice(bestPrice, product.currency || "LKR")} with offer
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    color: "#181818",
    paddingHorizontal: 16,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: "#fff0f3",
    borderWidth: 1.5,
    borderColor: "#ff3f6c",
  },
  tabPillInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  tabPillText: {
    fontSize: 13,
  },
  tabPillTextActive: {
    fontFamily: fontFamilies.sans.bold,
    color: "#ff3f6c",
  },
  tabPillTextInactive: {
    fontFamily: fontFamilies.sans.medium,
    color: "#3f3f46",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 20,
  },
  imageContainer: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f4f3ef",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eceae4",
  },
  infoContainer: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  brandName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: "#111111",
    letterSpacing: 0.3,
    flex: 1,
  },
  heartButton: {
    padding: 2,
  },
  productTitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "#555555",
    marginTop: 2,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  mrpText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: "#999999",
    textDecorationLine: "line-through",
  },
  priceText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: "#111111",
  },
  discountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11.5,
    color: "#ff5722",
  },
  offerText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: "#02833a",
    marginTop: 2,
  },
  loadingMoreWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },
  loadingMoreText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: "#71717a",
  },
  endCapWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  endCapLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e7",
  },
  endCapText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "#a1a1aa",
    letterSpacing: 1.2,
  },
  skeletonCard: {
    marginBottom: 20,
  },
  skeletonImage: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#e8e7e1",
  },
  skeletonLineShort: {
    width: "50%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 8,
  },
  skeletonLineLong: {
    width: "85%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 6,
  },
  skeletonLinePrice: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 6,
  },
});
