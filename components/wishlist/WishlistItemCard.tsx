import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows } from "@/lib/theme/tokens";
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

function getStock(product: Product) {
  if (!product.variants?.length) return Infinity;
  return product.variants[0]?.stock ?? 0;
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
  const variant = product.variants?.[0];
  const stock = getStock(product);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && Number.isFinite(stock) && stock <= 3;
  const discount = discountPct(product.mrp, product.price);
  const brandLabel = product.store?.name || product.brand?.name || "LUXE";

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
        stock: product.variants?.length ? stock : null,
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
          <BlurView
            intensity={40}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="heart" size={15} color={colors.accent2.rust} />
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
          {brandLabel.toUpperCase()}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
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
            size={14}
            color={isOutOfStock ? colors.olive[800] : colors.paper.cream}
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
    backgroundColor: "#FFFFFF",
    borderRadius: radii["3xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[700]}26`,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  imageWrap: {
    width: "100%",
    position: "relative",
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageMuted: {
    opacity: 0.55,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 64,
  },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.paper.cream}B3`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.paper.cream}`,
  },
  discountBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "#15160f",
  },
  discountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.accent2.ochre,
  },
  soldOutPill: {
    position: "absolute",
    alignSelf: "center",
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: "rgba(22,23,15,0.45)",
  },
  soldOutText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.paper.cream,
  },
  info: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  brandName: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.4,
  },
  productName: {
    marginTop: 5,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    lineHeight: 19,
    // Reserve two lines so cards in the same row line up.
    minHeight: 38,
    color: INK,
    letterSpacing: -0.2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: 6,
    marginTop: 8,
  },
  price: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: INK,
    letterSpacing: -0.1,
  },
  priceSale: {
    color: colors.accent2.rust,
  },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[400],
  },
  stockDotLow: {
    backgroundColor: colors.accent2.ochre,
  },
  stockDotOut: {
    backgroundColor: colors.accent2.rust,
  },
  stockText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[600],
  },
  stockTextLow: {
    color: "#9a7a26",
  },
  stockTextOut: {
    color: colors.accent2.rust,
  },
  ctaSpacer: {
    // Pushes the CTA to the card's bottom edge so buttons align across a row.
    flexGrow: 1,
    minHeight: 12,
  },
  actionBtn: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: radii.full,
    backgroundColor: "#15160f",
  },
  actionBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: `${colors.olive[800]}40`,
  },
  actionBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  actionText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.paper.cream,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  actionTextGhost: {
    color: colors.olive[800],
  },
});
