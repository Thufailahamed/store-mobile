import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface ProductInfoProps {
  product: Product;
  unitPrice: number;
}

export function ProductInfo({
  product,
  unitPrice,
}: ProductInfoProps) {
  const pct = discountPct(product.mrp, unitPrice);
  const showRating = product.total_reviews > 0 && product.rating > 0;

  return (
    <View style={styles.container}>
      {/* Brand with olive line */}
      {product.brand && (
        <View style={styles.brandRow}>
          <View style={styles.brandLine} />
          {product.brand.slug ? (
            <Link href={`/(main)/brands/${product.brand.slug}` as never} asChild>
              <TouchableOpacity hitSlop={4}>
                <Label style={styles.brandName}>{product.brand.name}</Label>
              </TouchableOpacity>
            </Link>
          ) : (
            <Label style={styles.brandName}>{product.brand.name}</Label>
          )}
        </View>
      )}

      {/* Product name — full width; wishlist + share live in the top bar */}
      <Display size="3xl" style={styles.name}>{product.name}</Display>

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

      {/* Price */}
      <View style={styles.priceBlock}>
        <View style={styles.priceRow}>
          <Price size="2xl" style={styles.activePrice}>
            {formatPrice(unitPrice, product.currency)}
          </Price>
          {pct > 0 && (
            <Body muted style={styles.mrp}>
              {formatPrice(product.mrp, product.currency)}
            </Body>
          )}
        </View>
        <View style={styles.metaRow}>
          {pct > 0 && (
            <>
              <Body size="xs" style={styles.saveText}>
                You save {formatPrice(product.mrp - unitPrice, product.currency)}
              </Body>
              <View style={styles.dot} />
            </>
          )}
          <Body size="xs" muted style={styles.taxNote}>
            Inclusive of all taxes
          </Body>
        </View>
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
  name: {
    letterSpacing: -0.4,
    lineHeight: 36,
    fontFamily: fontFamilies.display.semibold,
    color: colors.light.foreground,
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
  priceBlock: {
    gap: 6,
    marginTop: spacing[1],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
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
    fontSize: 15,
    color: colors.light.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  saveText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  taxNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
});
