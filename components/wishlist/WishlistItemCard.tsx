import React, { useState } from "react";
import { View, Pressable, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { discountPct, formatPrice } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/lib/types";
import { useWishlistLayout } from "@/components/wishlist/layout";
import { subscribeStockAlertBackend } from "@/lib/api/backend";

const INK = colors.light.foreground;
const MUTED = colors.light.mutedForeground;
const BORDER = colors.light.border;

interface WishlistItemCardProps {
  product: Product;
}

function getStock(product: Product) {
  if (!product.variants?.length) return Infinity;
  return product.variants[0]?.stock ?? 0;
}

export function WishlistItemCard({ product }: WishlistItemCardProps) {
  const router = useRouter();
  const { cardWidth, imageHeight } = useWishlistLayout();
  const { addItem } = useCart();
  const { toggle } = useWishlist();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const primary =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const variant = product.variants?.[0];
  const stock = getStock(product);
  const isOutOfStock = stock <= 0;
  const discount = discountPct(product.mrp, product.price);
  const brandLabel = (product.store?.name || product.brand?.name || "LUXE").toUpperCase();

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

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && { opacity: 0.98 }]}
    >
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {primary ? (
          <Image source={{ uri: primary }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={24} color={MUTED} />
          </View>
        )}

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggle(product.id);
          }}
          hitSlop={8}
          accessibilityLabel="Remove from wishlist"
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="heart" size={16} color={colors.accent2.rust} />
        </Pressable>

        {discount > 0 && !isOutOfStock ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        ) : null}

        {isOutOfStock ? (
          <View style={styles.oosBanner}>
            <Text style={styles.oosBannerText}>OUT OF STOCK</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.brandName} numberOfLines={1}>
          {brandLabel}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>
          {discount > 0 && product.mrp ? (
            <Text style={styles.mrp}>{formatPrice(product.mrp, product.currency)}</Text>
          ) : null}
        </View>
        <View style={styles.stockRow}>
          <View style={[styles.stockDot, isOutOfStock && styles.stockDotOut]} />
          <Text style={[styles.stockText, isOutOfStock && styles.stockTextOut]}>
            {isOutOfStock ? "Out of stock" : "Ready to ship"}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.actionBtn, isOutOfStock && styles.actionBtnMuted]}
        onPress={isOutOfStock ? notifyMe : moveToBag}
        disabled={adding}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isOutOfStock ? "notifications-outline" : "bag-add-outline"}
          size={14}
          color={isOutOfStock ? colors.olive[700] : colors.paper.cream}
        />
        <Text style={[styles.actionText, isOutOfStock && styles.actionTextMuted]}>
          {isOutOfStock ? "NOTIFY ME" : adding ? "ADDING…" : "MOVE TO BAG"}
        </Text>
      </TouchableOpacity>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${colors.olive[700]}20`,
    overflow: "hidden",
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  imageWrap: {
    width: "100%",
    position: "relative",
    backgroundColor: "#f5f5f5",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.paper.cream}F2`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${colors.accent2.rust}30`,
  },
  discountBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.ochre,
  },
  discountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[950],
  },
  oosBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#c0392b",
    paddingVertical: 6,
    alignItems: "center",
  },
  oosBannerText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
  info: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  brandName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 0.8,
  },
  productName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 13,
    color: INK,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  price: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[800],
  },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.olive[500],
  },
  stockDotOut: {
    backgroundColor: colors.accent2.rust,
  },
  stockText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: colors.olive[700],
  },
  stockTextOut: {
    color: colors.accent2.rust,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
  },
  actionBtn: {
    width: "100%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.olive[900],
  },
  actionBtnMuted: {
    backgroundColor: colors.paper.warm,
  },
  actionText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.paper.cream,
    letterSpacing: 1,
  },
  actionTextMuted: {
    color: colors.olive[700],
  },
});
