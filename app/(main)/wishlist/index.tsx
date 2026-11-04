import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Text, Share, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { navigateHome } from "@/lib/navigation";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import {
  AnimatedFlatList,
  useHideTabBarOnScroll,
} from "@/lib/hooks/useTabBarScroll";
import { Body } from "@/components/ui/Typography";
import { HeadingText as Display } from "@/components/user/user-page";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing } from "@/lib/theme/tokens";
import { useWishlist, useCart } from "@/lib/stores";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import {
  createWishlistShareBackend,
  getProductsByIdsBackend,
} from "@/lib/api/backend";
import { Ionicons } from "@/components/ui/Icon";
import { mapProducts } from "@/lib/api/product-mapper";
import { formatPrice, discountPct } from "@/lib/utils";
import { WishlistItemCard, getStock } from "@/components/wishlist/WishlistItemCard";
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
import { UserPageFrame, UP as C } from "@/components/user/user-page";

const getProductStock = getStock;

export default function WishlistScreen() {
  const router = useRouter();
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
    [wishlist.items],
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
    [products],
  );
  const inStockCount = useMemo(
    () => products.filter((p) => getProductStock(p) > 0).length,
    [products],
  );
  const onSaleCount = useMemo(
    () => products.filter((p) => discountPct(p.mrp, p.price) > 0).length,
    [products],
  );
  const savings = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + (p.mrp && p.mrp > p.price ? p.mrp - p.price : 0),
        0,
      ),
    [products],
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
      <UserPageFrame title="Wishlist" onBack={() => navigateHome(router)}>
        <WishlistEmptyState hasBagItems={cart.itemCount() > 0} />
      </UserPageFrame>
    );
  }

  return (
    <UserPageFrame title="Wishlist" onBack={() => navigateHome(router)}>
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
            <View style={styles.heroShadow}>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="heart" size={22} color={C.rust} />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>Saved pieces</Text>
                    <Text style={styles.heroSubtitle} numberOfLines={1}>
                      A private edit of pieces you love
                    </Text>
                  </View>
                  {user?.id ? (
                    <Pressable
                      onPress={() => void handleShare()}
                      style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Share wishlist"
                      hitSlop={6}
                    >
                      <Ionicons name="share-outline" size={18} color={C.text} />
                    </Pressable>
                  ) : null}
                </View>

                {savings > 0 ? (
                  <View style={styles.savePill}>
                    <View style={styles.saveIcon}>
                      <Ionicons name="pricetag" size={12} color={C.ink} />
                    </View>
                    <Text style={styles.saveText}>
                      You save{" "}
                      <Text style={styles.saveValue}>{formatPrice(savings, currency)}</Text>
                      {" "}on {onSaleCount} sale {onSaleCount === 1 ? "piece" : "pieces"}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.statsStrip}>
                  <Stat label={products.length === 1 ? "Piece" : "Pieces"} value={`${products.length}`} />
                  <View style={styles.statDivider} />
                  <Stat label="In stock" value={`${inStockCount}`} />
                  <View style={styles.statDivider} />
                  <Stat label="Total value" value={formatPrice(totalValue, currency)} wide />
                </View>
              </View>
            </View>

            <WishlistSegmentBar
              filter={filter}
              sort={sort}
              onFilterChange={setFilter}
              onSortChange={setSort}
              counts={{
                all: products.length,
                in_stock: inStockCount,
                on_sale: onSaleCount,
              }}
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
                <Ionicons
                  name="cloud-offline-outline"
                  size={26}
                  color={C.rust}
                />
              </View>
              <Display size="lg" style={styles.loadErrorTitle}>
                Your collection is still saved
              </Display>
              <Body muted size="sm" style={styles.loadErrorText}>
                {loadError}
              </Body>
              <Pressable
                onPress={() => setRetryNonce((value) => value + 1)}
                style={styles.retryBtn}
              >
                <Ionicons name="refresh" size={15} color={C.lime} />
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.filterEmpty}>
              <View style={styles.filterEmptyIcon}>
                <Ionicons name="funnel-outline" size={24} color={C.accent} />
              </View>
              <Display size="lg" style={styles.filterEmptyTitle}>
                Nothing here yet
              </Display>
              <Body muted size="sm" style={styles.loadErrorText}>
                {filter === "on_sale"
                  ? "None of your saved pieces are on sale right now."
                  : "No saved pieces match this filter."}
              </Body>
              <Pressable
                onPress={() => setFilter("all")}
                style={styles.filterEmptyBtn}
              >
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
    </UserPageFrame>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: WISHLIST_H_PAD,
    flexGrow: 1,
  },
  headerBlock: {
    gap: spacing[5],
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
    overflow: "visible",
  },
  heroShadow: {
    borderRadius: 26,
    backgroundColor: C.card,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  hero: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    gap: 16,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,92,58,0.1)",
  },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  heroTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  heroSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  shareBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1e8",
  },
  savePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 6,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: C.accentSoft,
  },
  saveIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  saveText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.text },
  saveValue: { fontFamily: fontFamilies.sans.bold, color: C.accent },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  statWide: { flex: 1.5 },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
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
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    marginBottom: spacing[3],
  },
  filterEmptyTitle: { color: C.text, textAlign: "center" },
  filterEmptyBtn: {
    marginTop: spacing[4],
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  filterEmptyBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.cream },
  loadErrorCard: {
    marginTop: spacing[4],
    padding: spacing[6],
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  loadErrorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,92,58,0.1)",
    marginBottom: spacing[3],
  },
  loadErrorTitle: { color: C.text, textAlign: "center" },
  loadErrorText: { textAlign: "center", marginTop: spacing[2] },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[4],
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  retryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.cream },
  footer: {
    paddingTop: spacing[2],
  },
});
