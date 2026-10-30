import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Text, Share, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader, PaperBackground } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedFlatList, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { useWishlist, useCart } from "@/lib/stores";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { createWishlistShareBackend, getProductsByIdsBackend } from "@/lib/api/backend";
import { Ionicons } from "@/components/ui/Icon";
import { mapProducts } from "@/lib/api/product-mapper";
import { formatPrice, discountPct } from "@/lib/utils";
import { WishlistItemCard } from "@/components/wishlist/WishlistItemCard";
import {
  WishlistSegmentBar,
  type WishlistFilter,
  type WishlistSort,
} from "@/components/wishlist/WishlistSegmentBar";
import { WishlistSkeleton } from "@/components/wishlist/WishlistSkeleton";
import { WishlistEmptyState } from "@/components/wishlist/WishlistEmptyState";
import { YouMayAlsoLove } from "@/components/wishlist/YouMayAlsoLove";
import {
  WISHLIST_GRID_GAP,
  WISHLIST_H_PAD,
  useWishlistLayout,
} from "@/components/wishlist/layout";
import type { Product } from "@/lib/types";
import { useTrackViewableItems } from "@/lib/recommender";

function getProductStock(product: Product): number {
  if (!product.variants?.length) return Infinity;
  return product.variants[0]?.stock ?? 0;
}

function formatCompactValue(amount: number, currency = "LKR") {
  if (amount >= 1000) {
    const compact = amount / 1000;
    const label = compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "");
    return `${currency} ${label}k`;
  }
  return formatPrice(amount, currency);
}

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const { cardWidth } = useWishlistLayout();
  const tabBarScrollHandler = useHideTabBarOnScroll();
  const { toast } = useToast();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WishlistFilter>("all");
  const [sort, setSort] = useState<WishlistSort>("recent");
  const [addedAt, setAddedAt] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const productIds = useMemo(
    () => Object.keys(wishlist.items),
    [wishlist.items]
  );

  useEffect(() => {
    let cancelled = false;
    if (productIds.length === 0) {
      setProducts([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setAddedAt((prev) => {
      const next = { ...prev };
      const now = Date.now();
      productIds.forEach((id, i) => {
        if (!(id in next)) next[id] = now - (productIds.length - i) * 1000;
      });
      return next;
    });

    (async () => {
      try {
        setLoading(true);
        const res = await getProductsByIdsBackend(productIds);
        if (cancelled) return;
        if (!res.ok) {
          console.error("[wishlist] fetch error:", res.error);
          setLoadError(res.error || "Could not load your saved pieces");
        } else {
          setProducts(mapProducts(res.data?.products ?? []));
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[wishlist] fetch exception:", err);
          setLoadError("Could not load your saved pieces");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productIds, retryNonce]);

  const visibleProducts = useMemo(() => {
    let list = [...products];
    if (filter === "in_stock") {
      list = list.filter((p) => getProductStock(p) > 0);
    } else if (filter === "on_sale") {
      list = list.filter((p) => discountPct(p.mrp, p.price) > 0);
    }
    list.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "name":
          return a.name.localeCompare(b.name);
        case "recent":
        default:
          return (addedAt[b.id] ?? 0) - (addedAt[a.id] ?? 0);
      }
    });
    return list;
  }, [products, filter, sort, addedAt]);

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + (p.price || 0), 0),
    [products]
  );
  const inStockCount = useMemo(
    () => products.filter((p) => getProductStock(p) > 0).length,
    [products]
  );
  const onSaleCount = useMemo(
    () => products.filter((p) => discountPct(p.mrp, p.price) > 0).length,
    [products]
  );
  const savings = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + (p.mrp && p.mrp > p.price ? p.mrp - p.price : 0),
        0
      ),
    [products]
  );
  const currency = products[0]?.currency || "LKR";

  const shareUrl = (token: string) => {
    const web =
      (process.env.EXPO_PUBLIC_WEB_APP_URL ?? "").replace(/\/$/, "") ||
      "https://synapstore.shop";
    return `${web}/wishlist/shared/${token}`;
  };

  const handleShare = async () => {
    if (!user?.id) {
      toast("Sign in to share your wishlist", "error");
      return;
    }
    const res = await createWishlistShareBackend();
    if (!res.ok) {
      toast(res.error ?? "Could not create share link", "error");
      return;
    }
    const url = shareUrl(res.data.link.token);
    try {
      await Share.share({ message: `My LUXE wishlist: ${url}`, url });
    } catch {
      toast("Could not open share sheet", "error");
    }
  };

  const viewable = useTrackViewableItems(visibleProducts, "wishlist");

  if (!loading && productIds.length === 0) {
    return (
      <PaperBackground style={styles.screen}>
        <AppHeader compact showTicker={false} showSearch={false} showBackToHome />
        <WishlistEmptyState hasBagItems={cart.itemCount() > 0} />
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={styles.screen}>
      <AppHeader compact showTicker={false} showSearch={false} showBackToHome />
      <AnimatedFlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        removeClippedSubviews={false}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        {...viewable}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.hero}>
              <LinearGradient
                colors={[colors.olive[900], colors.olive[950], "#0e1006"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroOrb} pointerEvents="none" />
              <View style={styles.heroOrbInner} pointerEvents="none" />
              <Ionicons
                name="heart-outline"
                size={150}
                color={`${colors.paper.cream}08`}
                style={styles.heroGlyph}
              />

              <View style={styles.heroTop}>
                <View style={styles.kickerRow}>
                  <View style={styles.kickerRule} />
                  <Label style={styles.heroKicker}>Your Collection</Label>
                </View>
                {user?.id ? (
                  <Pressable
                    onPress={() => void handleShare()}
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Share collection"
                    hitSlop={6}
                  >
                    <Ionicons name="share-outline" size={14} color={colors.paper.cream} />
                    <Text style={styles.shareBtnText}>Share</Text>
                  </Pressable>
                ) : null}
              </View>

              <Display size="3xl" style={styles.heroTitle}>
                Saved Pieces
              </Display>
              <Text style={styles.heroSubtitle}>
                {savings > 0 ? (
                  <>
                    You{"'"}re saving{" "}
                    <Text style={styles.heroValue}>{formatPrice(savings, currency)}</Text> on
                    pieces you love.
                  </>
                ) : (
                  "A private edit of the pieces you keep coming back to."
                )}
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.statRow}>
                <Stat label="Pieces" value={`${products.length}`} />
                <View style={styles.statDivider} />
                <Stat label="In stock" value={`${inStockCount}`} />
                <View style={styles.statDivider} />
                <Stat
                  label="Value"
                  value={formatCompactValue(totalValue, currency)}
                  highlight
                />
              </View>
            </View>

            <WishlistSegmentBar
              filter={filter}
              sort={sort}
              onFilterChange={setFilter}
              onSortChange={setSort}
              counts={{ all: products.length, in_stock: inStockCount, on_sale: onSaleCount }}
              visibleCount={visibleProducts.length}
            />

          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.gridItem, { width: cardWidth }]}>
            <WishlistItemCard product={item} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <WishlistSkeleton />
          ) : loadError ? (
            <View style={styles.loadErrorCard}>
              <View style={styles.loadErrorIcon}>
                <Ionicons name="cloud-offline-outline" size={20} color={colors.accent2.rust} />
              </View>
              <Display size="md" style={styles.loadErrorTitle}>Your collection is still saved</Display>
              <Body muted size="sm" style={styles.loadErrorText}>{loadError}</Body>
              <Pressable onPress={() => setRetryNonce((value) => value + 1)} style={styles.retryBtn}>
                <Ionicons name="refresh" size={14} color={colors.paper.cream} />
                <Label style={styles.retryText}>Try again</Label>
              </Pressable>
            </View>
          ) : (
            <View style={styles.filterEmpty}>
              <View style={styles.filterEmptyIcon}>
                <Ionicons name="funnel-outline" size={18} color={colors.olive[700]} />
              </View>
              <Display size="md" style={styles.filterEmptyTitle}>Nothing here yet</Display>
              <Body muted size="sm" style={styles.loadErrorText}>
                {filter === "on_sale"
                  ? "None of your saved pieces are on sale right now."
                  : "No saved pieces match this filter."}
              </Body>
              <Pressable onPress={() => setFilter("all")} style={styles.filterEmptyBtn}>
                <Text style={styles.filterEmptyBtnText}>Show all pieces</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          products.length > 0 ? (
            <View style={styles.footer}>
              <YouMayAlsoLove excludeIds={productIds} />
            </View>
          ) : null
        }
      />


    </PaperBackground>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: WISHLIST_H_PAD,
    flexGrow: 1,
  },
  headerBlock: {
    gap: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    overflow: "visible",
  },
  hero: {
    overflow: "hidden",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[5],
    borderRadius: radii["3xl"],
    backgroundColor: colors.olive[950],
    ...shadows.editorial,
  },
  heroOrb: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -90,
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}26`,
  },
  heroOrbInner: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -30,
    top: -50,
    backgroundColor: `${colors.accent2.ochre}0F`,
  },
  heroGlyph: {
    position: "absolute",
    right: -24,
    bottom: -28,
    transform: [{ rotate: "-12deg" }],
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  kickerRule: {
    width: 18,
    height: 1,
    backgroundColor: colors.accent2.ochre,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.accent2.ochre,
  },
  heroTitle: {
    marginTop: spacing[4],
    color: colors.paper.cream,
    fontFamily: fontFamilies.display.regular,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    marginTop: spacing[2],
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: `${colors.paper.cream}A6`,
    maxWidth: "90%",
  },
  heroValue: {
    fontFamily: fontFamilies.display.italic,
    color: colors.accent2.ochre,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.paper.cream}40`,
    backgroundColor: `${colors.paper.cream}14`,
  },
  shareBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: colors.paper.cream,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: `${colors.paper.cream}26`,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: `${colors.paper.cream}80`,
  },
  statValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.paper.cream,
  },
  statValueHighlight: {
    color: colors.accent2.ochre,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginRight: spacing[4],
    backgroundColor: `${colors.paper.cream}26`,
  },
  gridRow: {
    gap: WISHLIST_GRID_GAP,
    marginBottom: WISHLIST_GRID_GAP,
  },
  gridItem: {},
  filterEmpty: {
    paddingVertical: spacing[10],
    alignItems: "center",
    justifyContent: "center",
  },
  filterEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
    marginBottom: spacing[3],
  },
  filterEmptyTitle: {
    color: colors.ink.DEFAULT,
    textAlign: "center",
  },
  filterEmptyBtn: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${colors.olive[800]}40`,
  },
  filterEmptyBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[800],
  },
  loadErrorCard: {
    marginTop: spacing[4],
    padding: spacing[6],
    alignItems: "center",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${colors.accent2.rust}28`,
    backgroundColor: colors.paper.cream,
  },
  loadErrorIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent2.rust}12`,
    marginBottom: spacing[3],
  },
  loadErrorTitle: {
    color: colors.light.foreground,
    textAlign: "center",
  },
  loadErrorText: {
    textAlign: "center",
    marginTop: spacing[2],
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
  },
  retryText: {
    color: colors.paper.cream,
    fontSize: 10,
  },
  footer: {
    paddingTop: spacing[2],
  },
});
