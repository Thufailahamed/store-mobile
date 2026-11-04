import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import { discountPct, formatPrice } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/lib/types";
import { useWishlistLayout } from "@/components/wishlist/layout";
import { subscribeStockAlertBackend } from "@/lib/api/backend";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";

const INK = colors.ink.DEFAULT;
const MUTED = colors.ink.mute;

interface WishlistItemCardProps {
  product: Product;
}

/** Total stock across every variant (no variants = untracked, always available). */
export function getStock(product: Product) {
  if (!product.variants?.length) return Infinity;
  return product.variants.reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0);
}

/** Names often end in " - Brand"; the brand already sits above, so drop the echo. */
function displayName(name: string, brand: string) {
  const suffix = new RegExp(`\\s*[-–—|·]\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const trimmed = name.replace(suffix, "").trim();
  return trimmed || name;
}

export function WishlistItemCard({ product }: WishlistItemCardProps) {
  const router = useRouter();
  const { imageHeight } = useWishlistLayout();
  const { addItem } = useCart();
  const { toggle } = useWishlist();
  const toggleWishlist = useWishlistToggle();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const primary =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  // Move the first variant that can actually ship, not blindly the first one.
  const variant =
    product.variants?.find((v) => (v.stock ?? 0) > 0) ?? product.variants?.[0];
  const stock = getStock(product);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && Number.isFinite(stock) && stock <= 3;
  const discount = discountPct(product.mrp, product.price);
  const brandLabel = product.store?.name || product.brand?.name || "LUXE";
  const name = displayName(product.name, brandLabel);

  const open = () =>
    router.push({
      pathname: "/(main)/products/[slug]",
      params: { slug: product.slug || product.id },
    });

  const moveToBag = async () => {
    if (adding || isOutOfStock) return;
    setAdding(true);
    try {
      addItem({
        productId: product.id,
        variantId: variant?.id ?? null,
        storeId: product.store_id,
        name: product.name,
        variantLabel: variant
          ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim()
          : undefined,
        price: product.price,
        image: primary,
        stock: product.variants?.length ? (variant?.stock ?? 0) : null,
        quantity: 1,
      });
      toggle(product.id);
      toast(`Moved ${product.name} to bag`, "success");
    } finally {
      setAdding(false);
    }
  };

  const notifyMe = async () => {
    const res = await subscribeStockAlertBackend(product.id, variant?.id);
    if (res.ok) toast("We'll notify you when this piece is back", "success");
    else toast(res.error ?? "Could not set alert", "error");
  };

  const stockLabel = isOutOfStock
    ? "Sold out"
    : isLowStock
      ? `Only ${stock} left`
      : "Ready to ship";

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPrice(product.price, product.currency)}`}
    >
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {primary ? (
          <Image
            source={{ uri: primary }}
            style={[styles.image, isOutOfStock && styles.imageMuted]}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={24} color={MUTED} />
          </View>
        )}

        <LinearGradient
          colors={["rgba(22,23,15,0.18)", "rgba(22,23,15,0)"]}
          style={styles.topScrim}
          pointerEvents="none"
        />

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleWishlist(product, primary);
          }}
          hitSlop={10}
          accessibilityLabel="Remove from wishlist"
          style={({ pressed }) => [
            styles.heartBtn,
            pressed && { transform: [{ scale: 0.9 }] },
          ]}
        >
          <Ionicons name="heart" size={16} color={C.rust} />
        </Pressable>

        {discount > 0 && !isOutOfStock ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>−{discount}%</Text>
          </View>
        ) : null}

        {isOutOfStock ? (
          <View style={styles.soldOutPill}>
            <BlurView
              intensity={30}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.brandName} numberOfLines={1}>
          {brandLabel}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, discount > 0 && styles.priceSale]}>
            {formatPrice(product.price, product.currency)}
          </Text>
          {discount > 0 && product.mrp ? (
            <Text style={styles.mrp}>
              {formatPrice(product.mrp, product.currency)}
            </Text>
          ) : null}
        </View>

        <View style={styles.stockRow}>
          <View
            style={[
              styles.stockDot,
              isLowStock && styles.stockDotLow,
              isOutOfStock && styles.stockDotOut,
            ]}
          />
          <Text
            style={[
              styles.stockText,
              isLowStock && styles.stockTextLow,
              isOutOfStock && styles.stockTextOut,
            ]}
          >
            {stockLabel}
          </Text>
        </View>

        <View style={styles.ctaSpacer} />

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            void (isOutOfStock ? notifyMe() : moveToBag());
          }}
          disabled={adding}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.actionBtn,
            isOutOfStock && styles.actionBtnGhost,
            pressed && styles.actionBtnPressed,
          ]}
        >
          <Ionicons
            name={isOutOfStock ? "notifications-outline" : "bag-add-outline"}
            size={15}
            color={isOutOfStock ? C.text : C.lime}
          />
          <Text
            style={[styles.actionText, isOutOfStock && styles.actionTextGhost]}
          >
            {isOutOfStock ? "Notify me" : adding ? "Adding…" : "Move to bag"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardPressed: { transform: [{ scale: 0.985 }] },
  imageWrap: { width: "100%", position: "relative", backgroundColor: "#f0ede2" },
  image: { width: "100%", height: "100%" },
  imageMuted: { opacity: 0.55 },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 64 },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  discountBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  discountText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: C.ink, fontVariant: ["tabular-nums"] },
  soldOutPill: {
    position: "absolute",
    alignSelf: "center",
    bottom: 12,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(22,23,15,0.55)",
  },
  soldOutText: { fontFamily: fontFamilies.sans.bold, fontSize: 11.5, letterSpacing: 0.3, color: C.cream },
  info: { flex: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14 },
  brandName: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.muted },
  productName: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    lineHeight: 19,
    // Reserve two lines so cards in the same row line up.
    minHeight: 38,
    color: C.text,
    letterSpacing: -0.3,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6, marginTop: 8 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  priceSale: { color: C.rust },
  mrp: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: C.muted, textDecorationLine: "line-through" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  stockDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent },
  stockDotLow: { backgroundColor: colors.accent2.ochre },
  stockDotOut: { backgroundColor: C.rust },
  stockText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.accent },
  stockTextLow: { color: "#9a7a26" },
  stockTextOut: { color: C.rust },
  ctaSpacer: {
    // Pushes the CTA to the card's bottom edge so buttons align across a row.
    flexGrow: 1,
    minHeight: 12,
  },
  actionBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  actionBtnGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(22,23,15,0.14)" },
  actionBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  actionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.cream },
  actionTextGhost: { color: C.text },
});
