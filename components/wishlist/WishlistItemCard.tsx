import React, { useState } from "react";
import { View, Pressable, StyleSheet, type ViewStyle, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice, discountPct } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/lib/types";
import { WISHLIST_CARD_WIDTH, WISHLIST_IMAGE_HEIGHT } from "@/components/wishlist/layout";

interface WishlistItemCardProps {
  product: Product;
  style?: ViewStyle;
}

export function WishlistItemCard({ product, style }: WishlistItemCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { addItem } = useCart();
  const { toggle } = useWishlist();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const primary =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const discount = discountPct(product.mrp, product.price);
  const variant = product.variants?.[0];

  const open = () =>
    router.push({
      pathname: "/(main)/products/[slug]",
      params: { slug: product.slug || product.id },
    });

  const moveToBag = async (e?: any) => {
    e?.stopPropagation?.();
    if (adding) return;
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
        stock: variant?.stock ?? 99,
        quantity: 1,
      });
      toggle(product.id);
      toast(`Moved ${product.name} to bag`, "success");
    } finally {
      setAdding(false);
    }
  };

  const isOutOfStock = variant?.stock === 0;

  // Calculate simulated price drop dynamically (10% of the total discount)
  const priceDropAmount = discount > 0 ? Math.round((product.mrp - product.price) * 0.1) : 0;

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        pressed && { opacity: 0.98 },
        style,
      ]}
    >
      <View style={styles.imageWrap}>
        {primary ? (
          <Image
            source={{ uri: primary }}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={24}
              color={theme.colors.mutedForeground}
            />
          </View>
        )}

        {/* Remove from Wishlist button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggle(product.id);
          }}
          hitSlop={8}
          accessibilityLabel="Remove from wishlist"
          style={({ pressed }) => [
            styles.heart,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color="#16170f" />
        </Pressable>

        {/* Rating Badge */}
        {product.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Body style={styles.ratingText}>
              {product.rating.toFixed(0)} <Ionicons name="star" size={10} color={theme.isDark ? theme.olive[400] : theme.olive[600]} /> | {product.total_reviews}
            </Body>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Body size="sm" numberOfLines={1} style={[styles.productName, { color: theme.colors.foreground, fontFamily: fontFamilies.sans.bold, fontWeight: "700" }]}>
          {product.name}
        </Body>

        <View style={styles.priceRow}>
          <Label style={[styles.priceText, { color: theme.colors.foreground }]}>
            {formatPrice(product.price)}
          </Label>
          {discount > 0 ? (
            <>
              <Body size="xs" muted style={styles.mrpText}>
                {formatPrice(product.mrp)}
              </Body>
              <Label style={[styles.discountText, { color: theme.accent2.rust }]}>
                ({discount}% OFF)
              </Label>
            </>
          ) : null}
        </View>

        {/* Price drop indicator row */}
        {priceDropAmount > 0 && !isOutOfStock && (
          <View style={styles.priceDropRow}>
            <Ionicons name="arrow-down-circle-outline" size={15} color="#15803d" />
            <Body size="xs" style={styles.priceDropText}>
              Price dropped by {formatPrice(priceDropAmount)}
            </Body>
          </View>
        )}

        {isOutOfStock && (
          <Body style={styles.outOfStockText}>
            OUT OF STOCK
          </Body>
        )}
      </View>

      {/* Bottom docking button matching mockup layout */}
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <TouchableOpacity
        style={styles.moveToBagBtn}
        onPress={moveToBag}
        disabled={isOutOfStock}
        activeOpacity={0.8}
      >
        <Label style={[
          styles.moveToBagText, 
          { color: isOutOfStock ? theme.colors.mutedForeground : theme.colors.primary }
        ]}>
          {isOutOfStock ? "OUT OF STOCK" : "MOVE TO BAG"}
        </Label>
      </TouchableOpacity>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: WISHLIST_CARD_WIDTH,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
    ...shadows.soft,
  },
  imageWrap: {
    width: "100%",
    height: WISHLIST_IMAGE_HEIGHT,
    position: "relative",
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
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ratingText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.semibold,
    fontWeight: "600",
    color: "#16170f",
  },
  info: {
    padding: 12,
    gap: 3,
  },
  brandName: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  productName: {
    fontSize: 11,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  priceText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  mrpText: {
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  discountText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  priceDropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  priceDropText: {
    fontSize: 11,
    color: "#15803d",
    fontFamily: fontFamilies.sans.medium,
  },
  outOfStockText: {
    fontSize: 9,
    color: "#c0392b",
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  moveToBagBtn: {
    width: "100%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  moveToBagText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
