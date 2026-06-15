import React, { useState } from "react";
import { View, Pressable, StyleSheet, type ViewStyle, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
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

  // Premium Olive ramp gradient for the call-to-action button
  const buttonGradient = (theme.isDark 
    ? [theme.olive[400], theme.olive[600]] 
    : [theme.olive[500], theme.olive[700]]) as [string, string];

  // Soft background card gradient for editorial paper texture look
  const cardGradient = (theme.isDark
    ? ["#181913", "#0f100a"]
    : ["#faf8f1", "#f0ede4"]) as [string, string];

  const overlayBg = theme.isDark 
    ? "rgba(20, 21, 16, 0.8)" 
    : "rgba(255, 255, 255, 0.85)";

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.colors.border,
        },
        pressed && { opacity: 0.98 },
        style,
      ]}
    >
      <LinearGradient
        colors={cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
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
              {
                backgroundColor: overlayBg,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons name="trash-outline" size={14} color={theme.colors.foreground} />
          </Pressable>

          {/* Rating Badge */}
          {product.rating > 0 && (
            <View style={[styles.ratingBadge, { backgroundColor: overlayBg }]}>
              <Body style={[styles.ratingText, { color: theme.colors.foreground }]}>
                {product.rating.toFixed(1)} <Ionicons name="star" size={9} color={theme.olive[600]} /> | {product.total_reviews}
              </Body>
            </View>
          )}
        </View>

        <View style={styles.info}>
          {product.brand ? (
            <Label style={[styles.brandName, { color: theme.colors.mutedForeground }]} numberOfLines={1}>
              {product.brand.name}
            </Label>
          ) : (
            <Label style={[styles.brandName, { color: theme.colors.mutedForeground }]}>LUXE</Label>
          )}
          
          <Body size="xs" numberOfLines={1} muted style={styles.productName}>
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

          {isOutOfStock && (
            <Body style={styles.outOfStockText}>
              OUT OF STOCK
            </Body>
          )}

          {/* Premium call-to-action button */}
          <TouchableOpacity
            onPress={moveToBag}
            disabled={isOutOfStock}
            activeOpacity={0.8}
            style={{ width: "100%", marginTop: 8 }}
          >
            {isOutOfStock ? (
              <View style={[styles.moveToBagBtn, { backgroundColor: theme.colors.muted, shadowOpacity: 0, elevation: 0 }]}>
                <Label style={[styles.moveToBagText, { color: theme.colors.mutedForeground }]}>
                  OUT OF STOCK
                </Label>
              </View>
            ) : (
              <LinearGradient
                colors={buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moveToBagBtn}
              >
                <Label style={[styles.moveToBagText, { color: "#FFFFFF" }]}>
                  MOVE TO BAG
                </Label>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  ratingBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 9,
    fontFamily: fontFamilies.sans.semibold,
    fontWeight: "600",
  },
  info: {
    padding: 10,
    gap: 3,
  },
  brandName: {
    fontSize: 9.5,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
  outOfStockText: {
    fontSize: 9,
    color: "#c0392b",
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    marginTop: 2,
  },
  moveToBagBtn: {
    width: "100%",
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  moveToBagText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
