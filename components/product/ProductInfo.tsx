import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface ProductInfoProps {
  product: Product;
  unitPrice: number;
  isWishlisted: boolean;
  onWishlistToggle: () => void;
  onShare: () => void;
}

export function ProductInfo({
  product,
  unitPrice,
  isWishlisted,
  onWishlistToggle,
  onShare,
}: ProductInfoProps) {
  const pct = discountPct(product.mrp, unitPrice);
  const showRating = product.total_reviews > 0 && product.rating > 0;

  return (
    <View style={styles.container}>
      {/* Brand with olive line */}
      {product.brand && (
        <View style={styles.brandRow}>
          <View style={styles.brandLine} />
          <Label style={styles.brandName}>{product.brand.name}</Label>
        </View>
      )}

      {/* Product name and action buttons row */}
      <View style={styles.nameRow}>
        <Display size="3xl" style={styles.name}>{product.name}</Display>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onWishlistToggle}
            activeOpacity={0.8}
            accessibilityLabel="Add to wishlist"
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={20}
              color={isWishlisted ? colors.light.destructive : colors.light.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onShare}
            activeOpacity={0.8}
            accessibilityLabel="Share product"
          >
            <Ionicons name="share-outline" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Short description */}
      {product.short_description ? (
        <Body muted size="base" style={styles.shortDesc}>
          {product.short_description}
        </Body>
      ) : null}

      {/* Rating row */}
      {showRating && (
        <View style={styles.ratingRow}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={colors.accent2.ochre} />
            <Body style={styles.ratingNum}>{product.rating.toFixed(1)}</Body>
          </View>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= Math.round(product.rating) ? "star" : "star-outline"}
                size={12}
                color={s <= Math.round(product.rating) ? colors.accent2.ochre : colors.light.border}
              />
            ))}
          </View>
          <Body size="sm" style={styles.reviewCount}>
            {product.total_reviews} reviews
          </Body>
          <View style={styles.dot} />
          <Body size="sm" muted style={styles.soldText}>
            {(product as any).total_sold ?? 0} sold
          </Body>
        </View>
      )}

      {/* Olive divider */}
      <View style={styles.divider} />

      {/* Price */}
      <View style={styles.priceBlock}>
        <View style={styles.priceRow}>
          <Price size="2xl" style={styles.activePrice}>
            {formatPrice(unitPrice, product.currency)}
          </Price>
          {pct > 0 && (
            <Body muted size="lg" style={styles.mrp}>
              {formatPrice(product.mrp, product.currency)}
            </Body>
          )}
          {pct > 0 && (
            <View style={styles.saveBadge}>
              <Label style={styles.saveBadgeText}>
                SAVE {formatPrice(product.mrp - unitPrice, product.currency)}
              </Label>
            </View>
          )}
        </View>
        <Body size="xs" muted style={styles.taxNote}>
          Inclusive of all taxes
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  brandLine: {
    width: 16,
    height: 1,
    backgroundColor: colors.olive[600],
  },
  brandName: {
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    flex: 1,
    letterSpacing: -0.02,
    lineHeight: 34,
    fontFamily: fontFamilies.display.semibold,
    color: colors.light.foreground,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  shortDesc: {
    lineHeight: 22,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: `${colors.olive[600]}10`,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}25`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  ratingNum: {
    color: colors.olive[800],
    fontSize: 11,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 1,
  },
  reviewCount: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.mutedForeground,
  },
  soldText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
  },
  divider: {
    height: 1,
    backgroundColor: `${colors.olive[600]}20`,
    marginVertical: spacing[1],
  },
  priceBlock: {
    gap: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  activePrice: {
    fontFamily: fontFamilies.display.semibold,
    color: colors.light.foreground,
  },
  mrp: {
    textDecorationLine: "line-through",
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginLeft: 2,
  },
  saveBadge: {
    backgroundColor: `${colors.accent2.rust}12`,
    borderWidth: 1,
    borderColor: `${colors.accent2.rust}25`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginLeft: 4,
  },
  saveBadgeText: {
    color: colors.accent2.rust,
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.5,
  },
  taxNote: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
