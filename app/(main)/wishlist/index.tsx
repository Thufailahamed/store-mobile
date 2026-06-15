import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppHeader, PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";
import { useWishlist, useCart } from "@/lib/stores";
import type { CartStore } from "@/lib/stores/cart-store";
import { useToast } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
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
  WISHLIST_CARD_WIDTH,
  WISHLIST_GRID_GAP,
  WISHLIST_H_PAD,
} from "@/components/wishlist/layout";
import type { Product } from "@/lib/types";

function getProductStock(product: Product): number {
  return product.variants?.[0]?.stock ?? 0;
}

function addProductToCart(product: Product, cart: CartStore): boolean {
  const variant = product.variants?.[0];
  const stock = getProductStock(product);
  if (stock <= 0) return false;

  const image =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;

  cart.addItem({
    productId: product.id,
    variantId: variant?.id ?? null,
    storeId: product.store_id,
    name: product.name,
    variantLabel: variant
      ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim()
      : undefined,
    price: product.price,
    image,
    stock,
    quantity: 1,
  });
  return true;
}

export default function WishlistScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const wishlist = useWishlist();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WishlistFilter>("all");
  const [sort, setSort] = useState<WishlistSort>("recent");
  const [addedAt, setAddedAt] = useState<Record<string, number>>({});

  const productIds = useMemo(
    () => Object.keys(wishlist.items),
    [wishlist.items]
  );
  const idsKey = productIds.join(",");

  useEffect(() => {
    let cancelled = false;
    if (productIds.length === 0) {
      setProducts([]);
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
        const { data, error } = await supabase
          .from("products")
          .select(
            "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)"
          )
          .in("id", productIds);
        if (cancelled) return;
        if (error) {
          console.error("[wishlist] fetch error:", error);
          setProducts([]);
        } else {
          setProducts(mapProducts((data as Product[]) || []));
        }
      } catch (err) {
        if (!cancelled) console.error("[wishlist] fetch exception:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const visibleProducts = useMemo(() => {
    let list = [...products];
    if (filter === "in_stock") {
      list = list.filter((p) => (p.variants?.[0]?.stock ?? 0) > 0);
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
    () => products.filter((p) => (p.variants?.[0]?.stock ?? 0) > 0).length,
    [products]
  );

  const listBottomPad = insets.bottom + 24;

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
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.hero}>
              <Label style={{ color: theme.accent2.rust }}>
                Your Collection
              </Label>
              <Display
                size="3xl"
                italic
                style={[styles.heroTitle, { color: theme.colors.foreground }]}
              >
                Saved Pieces
              </Display>
              <Body muted size="md" style={styles.heroSubtitle}>
                {products.length}{" "}
                {products.length === 1 ? "piece" : "pieces"} ·{" "}
                <Body
                  size="md"
                  style={{
                    fontFamily: fontFamilies.display.regular,
                    fontStyle: "italic",
                    color: theme.olive[700],
                  }}
                >
                  {formatPrice(totalValue)} curated
                </Body>
              </Body>
            </View>

            <View
              style={[
                styles.statRow,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Stat
                label="Total"
                value={`${products.length}`}
                color={theme.colors.foreground}
                muted={theme.colors.mutedForeground}
              />
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />
              <Stat
                label="In stock"
                value={`${inStockCount}`}
                color={
                  inStockCount > 0
                    ? theme.olive[700]
                    : theme.colors.mutedForeground
                }
                muted={theme.colors.mutedForeground}
              />
              <View
                style={[
                  styles.statDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />
              <Stat
                label="Value"
                value={formatPrice(totalValue)}
                color={theme.colors.foreground}
                muted={theme.colors.mutedForeground}
              />
            </View>

            <WishlistSegmentBar
              filter={filter}
              sort={sort}
              onFilterChange={setFilter}
              onSortChange={setSort}
              style={styles.segmentBar}
            />

          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <WishlistItemCard product={item} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <WishlistSkeleton />
          ) : (
            <View style={styles.filterEmpty}>
              <Body muted>No pieces match this filter.</Body>
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
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.stat}>
      <Label style={[styles.statLabel, { color: muted }]}>{label}</Label>
      <Body size="sm" style={[styles.statValue, { color }]}>
        {value}
      </Body>
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
    gap: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  hero: {
    gap: spacing[2],
  },
  heroTitle: {
    marginTop: spacing[1],
  },
  heroSubtitle: {
    marginTop: spacing[1],
    fontFamily: fontFamilies.display.regular,
    fontStyle: "italic",
    lineHeight: 22,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
  },
  stat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: spacing[1],
  },
  segmentBar: {
    marginHorizontal: -WISHLIST_H_PAD,
  },
  gridRow: {
    gap: WISHLIST_GRID_GAP,
    marginBottom: WISHLIST_GRID_GAP,
  },
  gridItem: {
    width: WISHLIST_CARD_WIDTH,
  },
  filterEmpty: {
    paddingVertical: spacing[10],
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: spacing[2],
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[1],
  },
  selectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCountText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
  },
  checkoutContainer: {
    borderTopWidth: 1,
  },
  selectionBand: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    alignItems: "center",
    justifyContent: "center",
  },
  selectionBandText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    textAlign: "center",
  },
  checkoutAction: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  checkoutBtn: {
    width: "100%",
    minHeight: 54,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnDisabled: {
    opacity: 0.42,
  },
  checkoutBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
