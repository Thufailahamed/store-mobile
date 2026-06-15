import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";
import { useWishlist, useCart } from "@/lib/stores";
import { useToast } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
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
import type { Product } from "@/lib/types";

export default function WishlistScreen() {
  const router = useRouter();
  const theme = useTheme();
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

    // Stamp first-seen time per id (used for "Recently added" sort).
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
          setProducts(
            ((data as Product[]) || []).map((p) => {
              const variants = p.variants?.map((v: any) => ({
                ...v,
                stock: v.inventory?.[0]?.quantity ?? v.stock ?? 0,
              }));
              return { ...p, variants };
            })
          );
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

  const handleAddAll = useCallback(() => {
    const inStock = products.filter(
      (p) => (p.variants?.[0]?.stock ?? 0) > 0
    );
    if (!inStock.length) return;
    inStock.forEach((p) => {
      const v = p.variants?.[0];
      cart.addItem({
        productId: p.id,
        variantId: v?.id ?? null,
        storeId: p.store_id,
        name: p.name,
        variantLabel: v
          ? `${v.color ?? ""} ${v.size ?? ""}`.trim()
          : undefined,
        price: p.price,
        image: p.images?.[0]?.url,
        stock: v?.stock ?? 99,
        quantity: 1,
      });
    });
    toast(`${inStock.length} pieces moved to your bag`, "success");
  }, [products, cart, toast]);

  const handleClearAll = useCallback(() => {
    if (!products.length) return;
    products.forEach((p) => wishlist.toggle(p.id));
    toast("Wishlist cleared", "info");
  }, [products, wishlist, toast]);

  if (!loading && productIds.length === 0) {
    return (
      <PaperBackground>
        <AppHeader compact showTicker={false} showSearch={false} />
        <WishlistEmptyState hasBagItems={cart.itemCount() > 0} />
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <AppHeader compact showTicker={false} showSearch={false} />
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Label style={{ color: theme.accent2.rust }}>
                Your Collection
              </Label>
              <Display
                size="3xl"
                italic
                style={{
                  color: theme.colors.foreground,
                  marginTop: 6,
                }}
              >
                Saved Pieces
              </Display>
              <Body
                muted
                size="md"
                style={{
                  marginTop: 8,
                  fontFamily: fontFamilies.display.regular,
                  fontStyle: "italic",
                }}
              >
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

            <View style={styles.segmentWrap}>
              <WishlistSegmentBar
                filter={filter}
                sort={sort}
                onFilterChange={setFilter}
                onSortChange={setSort}
                style={{ marginHorizontal: -20 }}
              />
            </View>
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
          <View style={{ paddingBottom: 40 }}>
            {products.length > 0 ? (
              <View style={styles.bulkRow}>
                <Pressable
                  onPress={handleAddAll}
                  disabled={inStockCount === 0}
                  style={({ pressed }) => [
                    styles.bulkBtn,
                    { backgroundColor: theme.olive[700] },
                    inStockCount === 0 && { opacity: 0.4 },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Label style={{ color: "#fff", fontSize: 11 }}>
                    Add {inStockCount} to bag
                  </Label>
                </Pressable>
                <Pressable
                  onPress={handleClearAll}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.bulkGhost,
                    { borderColor: theme.colors.border },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Label
                    style={{
                      color: theme.colors.mutedForeground,
                      fontSize: 11,
                    }}
                  >
                    Clear all
                  </Label>
                </Pressable>
              </View>
            ) : null}

            <YouMayAlsoLove excludeIds={productIds} />
          </View>
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
      <Label style={{ color: muted, fontSize: 9 }}>{label}</Label>
      <Body
        size="sm"
        style={{
          color,
          fontFamily: fontFamilies.display.semibold,
          marginTop: 4,
          fontSize: 16,
        }}
      >
        {value}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingTop: spacing[2],
    paddingBottom: spacing[24],
  },
  hero: {
    paddingTop: spacing[4],
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: 14,
    marginTop: 20,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  row: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  gridItem: {
    flex: 1,
  },
  filterEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  bulkBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkGhost: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  segmentWrap: {
    marginTop: 14,
  },
});
