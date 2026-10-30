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

const INK = "#141414";
const MUTED = "#6b6b6b";

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
                <Ionicons name="pricetag-outline" size={11} color={INK} />
                <Body size="xs" style={styles.saveText}>
                  You save {formatPrice(product.mrp - unitPrice, product.currency)}
                </Body>
              </View>
            )}
            <View style={styles.taxRow}>
              <Ionicons name="shield-checkmark-outline" size={12} color={MUTED} />
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
  priceShadow: {
    marginTop: spacing[2],
    borderRadius: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  priceCard: {
    borderRadius: 24,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: INK,
  },
  priceEyebrow: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 2.4,
    fontFamily: fontFamilies.sans.bold,
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  discountText: {
    color: "#ffffff",
    fontSize: 11,
    letterSpacing: 0.4,
    fontFamily: fontFamilies.sans.bold,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing[3],
    flexWrap: "wrap",
  },
  activePrice: {
    fontFamily: fontFamilies.display.semibold,
    color: INK,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  mrp: {
    textDecorationLine: "line-through",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: "#9a9a9a",
  },
  priceRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.1)",
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
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  saveText: {
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
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
