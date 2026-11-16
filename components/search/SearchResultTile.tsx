import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { useProductActions } from "@/components/product/useProductActions";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

const INK = colors.ink.DEFAULT;
const MUTED = "#6b6b68";
const STAR = "#1f8a5b";

function compactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

interface Props {
  product: Product;
  width: number;
  onPress: (p: Product) => void;
}

/**
 * Dense marketplace tile for search results: tall edge-to-edge photo with a
 * rating chip, uppercase brand + heart on one line, one-line name, and a
 * strike-through MRP / price / % OFF row.
 */
export function SearchResultTile({ product, width, onPress }: Props) {
  const { primaryImage, discount, isSoldOut, isWishlisted, handleWishlist } = useProductActions(product);
  const brand = product.store?.name || product.brand?.name || "";
  const imageHeight = Math.round(width * 1.33);
  const showMrp = discount > 0 && product.mrp > product.price;

  return (
    <Pressable
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}
      onPress={() => onPress(product)}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${product.name}, ${formatPrice(product.price)}`}
    >
      <View style={[styles.stage, { height: imageHeight }]}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={28} color={MUTED} />
          </View>
        )}
        {product.rating > 0 ? (
          <View style={styles.ratingChip}>
            <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            <Ionicons name="star" size={10} color={STAR} />
            {product.total_reviews > 0 ? (
              <>
                <View style={styles.ratingDivider} />
                <Text style={styles.ratingCount}>{compactCount(product.total_reviews)}</Text>
              </>
            ) : null}
          </View>
        ) : null}
        {isSoldOut ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.heart}
          onPress={handleWishlist}
          hitSlop={10}
          accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={17}
            color={isWishlisted ? colors.accent2.rust : INK}
          />
        </TouchableOpacity>
      </View>

      {/* Centred metadata, matching the web product card: store eyebrow,
          uppercase tracked name, price row, red offer line. */}
      <View style={styles.info}>
        {brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {brand.toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {(product.name || "Untitled piece").toUpperCase()}
        </Text>
        <View style={styles.priceRow}>
          {showMrp ? <Text style={styles.mrp}>{formatPrice(product.mrp)}</Text> : null}
          <Text style={styles.price}>{product.price ? formatPrice(product.price) : "On request"}</Text>
        </View>
        {showMrp ? (
          <Text style={styles.off}>
            {discount}% off — you save {formatPrice(product.mrp - product.price)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ecebe6",
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  ratingChip: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  ratingText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: INK },
  ratingDivider: { width: 1, height: 11, backgroundColor: "#c9c9c4", marginHorizontal: 3 },
  ratingCount: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: MUTED },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, letterSpacing: 1.2, color: INK },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  info: { paddingTop: 10, paddingHorizontal: 4, alignItems: "center" },
  brand: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9.5,
    letterSpacing: 2,
    color: "rgba(20,20,20,0.45)",
    textAlign: "center",
  },
  name: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.6,
    color: "rgba(20,20,20,0.9)",
    textAlign: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flexWrap: "wrap",
    columnGap: 6,
    marginTop: 6,
  },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 1.2,
    color: "rgba(20,20,20,0.35)",
    textDecorationLine: "line-through",
  },
  price: { fontFamily: fontFamilies.sans.medium, fontSize: 11, letterSpacing: 1.2, color: "rgba(20,20,20,0.7)" },
  off: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: "#e00000",
    textAlign: "center",
  },
});
