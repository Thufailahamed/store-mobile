import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, FlatList, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { useCart, useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing } from "@/lib/theme/tokens";
import { formatPrice, FREE_SHIPPING_THRESHOLD, TAX_RATE } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { ShippingProgress } from "@/components/cart/ShippingProgress";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { BagEmptyState } from "@/components/cart/BagEmptyState";
import { SavedForLater } from "@/components/cart/SavedForLater";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";

export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    itemCount,
    couponCode,
    setCoupon,
  } = useCart();
  const wishlist = useWishlist();
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [savedForLater, setSavedForLater] = useState<
    Record<string, { product: Product | null }>
  >({});

  const cartItems = Object.entries(items);
  const sub = subtotal();
  const shippingFee = sub >= FREE_SHIPPING_THRESHOLD ? 0 : 350;
  const tax = Math.round((sub - couponDiscount) * TAX_RATE);
  const total = Math.max(0, sub - couponDiscount) + shippingFee + tax;
  const count = itemCount();
  const wishlistCount = wishlist.count();

  const handleRemove = useCallback(
    (key: string, name: string) => {
      removeItem(key);
      toast(`${name} removed from bag`, "info");
    },
    [removeItem, toast]
  );

  const handleSaveForLater = useCallback(
    (key: string, productId: string) => {
      const item = items[key];
      if (!item) return;
      // Optimistic local state — full impl would persist to a saved_for_later store.
      setSavedForLater((prev) => ({
        ...prev,
        [key]: { product: prev[key]?.product ?? null },
      }));
      // Mirror to wishlist so the product is preserved.
      if (!wishlist.has(productId)) wishlist.toggle(productId);
      removeItem(key);
      toast(`Saved for later`, "success");
    },
    [items, removeItem, wishlist, toast]
  );

  // Lazily fetch products for the saved-for-later rail.
  const savedKeys = Object.keys(savedForLater);
  const savedProductIds = useMemo(() => {
    const ids = new Set<string>();
    Object.entries(items).forEach(([_, it]) => {});
    savedKeys.forEach((k) => {
      const it = items[k];
      if (it) ids.add(it.productId);
    });
    return Array.from(ids);
  }, [savedKeys, items]);
  useEffect(() => {
    if (savedProductIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)"
        )
        .in("id", savedProductIds);
      if (cancelled || error || !data) return;
      const byId: Record<string, Product> = {};
      (data as Product[]).forEach((p) => {
        byId[p.id] = p;
      });
      setSavedForLater((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          const it = items[k];
          if (it && byId[it.productId]) {
            next[k] = { product: byId[it.productId] };
          }
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [savedProductIds.join(",")]);

  const heroStats = useMemo(() => {
    if (count === 0) return "Begin your edit";
    if (count === 1) return "1 piece selected";
    return `${count} pieces selected`;
  }, [count]);

  if (cartItems.length === 0) {
    return (
      <PaperBackground>
        <AppHeader compact showTicker={false} showSearch={false} />
        <BagEmptyState hasWishlistItems={wishlistCount > 0} />
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <AppHeader compact showTicker={false} showSearch={false} />
      <FlatList
        data={cartItems}
        keyExtractor={([key]) => key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Label style={{ color: theme.olive[600] }}>
                Step 01 of 03 · Edit
              </Label>
              <Display
                size="3xl"
                italic
                style={{
                  color: theme.colors.foreground,
                  marginTop: 6,
                }}
              >
                Your Bag
              </Display>
              <Body
                muted
                size="md"
                style={{
                  marginTop: 6,
                  fontFamily: fontFamilies.display.regular,
                  fontStyle: "italic",
                }}
              >
                {heroStats}
              </Body>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: spacing[5] }}>
              <ShippingProgress subtotal={sub} />
            </View>

            <View
              style={[
                styles.listHeader,
                {
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Label
                style={{
                  color: theme.colors.mutedForeground,
                  fontSize: 10,
                }}
              >
                Pieces
              </Label>
              <Label
                style={{
                  color: theme.colors.mutedForeground,
                  fontSize: 10,
                }}
              >
                Subtotal
              </Label>
            </View>
          </View>
        }
        renderItem={({ item: [key, cartItem], index }) => (
          <View
            style={[
              index === 0 ? { paddingTop: 4 } : null,
              {
                borderBottomWidth:
                  index === cartItems.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
                marginHorizontal: 20,
              },
            ]}
          >
            <CartItemCard
              item={cartItem}
              onIncrement={() => updateQuantity(key, cartItem.quantity + 1)}
              onDecrement={() => updateQuantity(key, cartItem.quantity - 1)}
              onRemove={() => handleRemove(key, cartItem.name)}
              onSaveForLater={() =>
                handleSaveForLater(key, cartItem.productId)
              }
            />
          </View>
        )}
        ListFooterComponent={
          <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <SavedForLater
              products={Object.values(savedForLater)
                .map((s) => s.product)
                .filter((p): p is Product => !!p)}
            />

            <OrderSummary
              subtotal={sub}
              shippingFee={shippingFee}
              tax={tax}
              total={total}
              couponCode={couponCode}
              couponDiscount={couponDiscount}
              userId={user?.id}
              onApplyCoupon={(code, discount) => {
                setCoupon(code);
                setCouponDiscount(discount);
              }}
              onClearCoupon={() => {
                setCoupon(null);
                setCouponDiscount(0);
              }}
              onCheckout={() => router.push("/(main)/checkout")}
              canCheckout={cartItems.length > 0}
            />

            <Body
              size="xs"
              muted
              style={{
                textAlign: "center",
                marginTop: 20,
                fontFamily: fontFamilies.display.regular,
                fontStyle: "italic",
                lineHeight: 18,
              }}
            >
              Each piece is hand‑finished at the atelier ·{" "}
              <Price size="xs" style={{ color: theme.colors.foreground }}>
                {formatPrice(total)}
              </Price>{" "}
              is your all‑in total
            </Body>
          </View>
        }
      />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[6],
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: spacing[4],
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    marginTop: 24,
    borderBottomWidth: 1,
  },
});
