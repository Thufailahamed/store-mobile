import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useWishlist } from "@/lib/stores";
import { useTrackEvent } from "@/lib/recommender";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { HOME_PRODUCT_CARD_WIDTH } from "./HomeProductCard";

interface ForYouProductCardProps {
  product: Product;
  /** Short human-readable reason — shown as a chip on the card. */
  reason?: string | null;
}

/**
 * Variant of the home product card with a "why" chip. Used in the
 * personalized rail to make the recommendation transparent.
 */
export function ForYouProductCard({ product, reason }: ForYouProductCardProps) {
  const router = useRouter();
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggle = useWishlist((s) => s.toggle);
  const tracker = useTrackEvent();
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const storeOrBrandName = product.store?.name || product.brand?.name;
  const onSale = product.mrp > product.price;
  const discount = onSale ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(main)/products/${product.slug}`)}
    >
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
          </View>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => {
            tracker.wishlist(product, isWishlisted ? "remove" : "add");
            toggle(product.id);
          }}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={16}
            color={isWishlisted ? colors.light.destructive : colors.light.foreground}
          />
        </TouchableOpacity>
        {onSale ? (
          <View style={styles.saleBadge}>
            <Text style={styles.saleText}>Sale</Text>
          </View>
        ) : null}
        {reason ? (
          <View style={styles.reasonChip}>
            <Ionicons name="sparkles" size={9} color={colors.olive[600]} />
            <Text style={styles.reasonText} numberOfLines={1}>{reason}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.productName} numberOfLines={1}>
        {product.name || "Untitled Piece"}
      </Text>

      {storeOrBrandName ? (
        <Text style={styles.storeName} numberOfLines={1}>
          {storeOrBrandName}
        </Text>
      ) : null}

      <View style={styles.priceRow}>
        {discount > 0 ? (
          <>
            <Text style={styles.originalPrice}>{formatPrice(product.mrp)}</Text>
            <Text style={styles.sellingPrice}>{formatPrice(product.price)}</Text>
            <Text style={styles.discountPct}>{discount}% OFF</Text>
          </>
        ) : (
          <Text style={styles.sellingPrice}>{formatPrice(product.price)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: HOME_PRODUCT_CARD_WIDTH,
  },
  imageWrap: {
    width: HOME_PRODUCT_CARD_WIDTH,
    height: HOME_PRODUCT_CARD_WIDTH,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    marginBottom: spacing[2],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saleText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.light.destructive,
  },
  reasonChip: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    maxWidth: HOME_PRODUCT_CARD_WIDTH - 16,
  },
  reasonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: colors.olive[600],
    flexShrink: 1,
  },
  productName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
    marginBottom: 2,
    lineHeight: 17,
  },
  storeName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginBottom: 3,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  sellingPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  originalPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
  discountPct: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.accent2.rust,
  },
});
