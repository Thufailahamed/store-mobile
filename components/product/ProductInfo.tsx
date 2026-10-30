import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

import { C } from "@/components/orders/parcel-track";

const INK = C.ink;
const MUTED = C.muted;

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

      {/* Price card */}
      <View style={styles.priceShadow}>
        <View style={styles.priceCard}>
          <View style={styles.priceTop}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Label style={styles.priceEyebrow}>{pct > 0 ? "SPECIAL PRICE" : "PRICE"}</Label>
            </View>
            {pct > 0 && (
              <View style={styles.discountBadge}>
                <Label style={styles.discountText}>−{pct}%</Label>
              </View>
            )}
          </View>
          <View style={styles.priceRow}>
            <Price size="2xl" style={styles.activePrice}>
              {formatPrice(unitPrice, product.currency)}
            </Price>
            {pct > 0 && (
              <Body style={styles.mrp}>
                {formatPrice(product.mrp, product.currency)}
              </Body>
            )}
          </View>
          <View style={styles.priceRule} />
          <View style={styles.metaRow}>
            {pct > 0 && (
              <View style={styles.saveChip}>
                <Ionicons name="pricetag-outline" size={11} color={C.ink} />
                <Body size="xs" style={styles.saveText}>
                  You save {formatPrice(product.mrp - unitPrice, product.currency)}
                </Body>
              </View>
            )}
            <View style={styles.taxRow}>
              <Ionicons name="shield-checkmark-outline" size={12} color={C.accent} />
              <Body size="xs" style={styles.taxNote}>
                Inclusive of all taxes
              </Body>
            </View>
          </View>
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
    backgroundColor: C.accent,
  },
  brandName: {
    color: C.accent,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  name: {
    letterSpacing: -0.8,
    lineHeight: 36,
    fontFamily: fontFamilies.display.semibold,
    color: C.text,
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
    backgroundColor: C.ink,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
  },
  ratingNum: {
    color: C.cream,
    fontSize: 11.5,
    fontFamily: fontFamilies.sans.bold,
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
  priceShadow: {
    marginTop: spacing[2],
    borderRadius: 26,
    backgroundColor: "#ffffff",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  priceCard: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#ffffff",
    gap: spacing[2.5],
  },
  priceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.lime,
  },
  priceEyebrow: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.mono.semibold,
  },
  discountBadge: {
    height: 26,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: radii.full,
    backgroundColor: C.ink,
  },
  discountText: {
    color: C.lime,
    fontSize: 11.5,
    fontFamily: fontFamilies.sans.bold,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing[3],
    flexWrap: "wrap",
  },
  activePrice: {
    fontFamily: fontFamilies.sans.bold,
    color: C.text,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
  },
  mrp: {
    textDecorationLine: "line-through",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: C.muted,
  },
  priceRule: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  saveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: C.lime,
  },
  saveText: {
    color: C.ink,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  taxNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: MUTED,
  },
});
