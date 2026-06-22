import React from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.62);

interface HeroCardProps {
  product: Product;
}

/**
 * Mobile HeroCard — full-width split block shown at the top of page 1
 * in editorial view. Image (left/top) + type block (right/bottom).
 * Port of web `components/products/hero-card.tsx`.
 */
export function HeroCard({ product }: HeroCardProps) {
  const router = useRouter();
  const primaryImage =
    product.images?.find((i) => i.is_primary)?.url ?? product.images?.[0]?.url;
  const pct = discountPct(product.mrp, product.price);
  const brandName = product.brand?.name;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/(main)/products/${product.slug}`)}
      style={styles.card}
    >
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        <View style={styles.stampRow}>
          <View style={styles.stamp}>
            <Ionicons name="flame-outline" size={10} color={colors.light.foreground} />
            <Label style={styles.stampText}>Editor's Pick</Label>
          </View>
        </View>
        {pct > 0 && (
          <View style={styles.discountBadge}>
            <Label style={styles.discountText}>{pct}% OFF</Label>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Label style={styles.kicker}>Nº 01 · Featured</Label>
        {brandName ? (
          <Label style={styles.brand}>{brandName}</Label>
        ) : null}
        <Display size="xl" style={styles.name} numberOfLines={2}>
          {product.name}
        </Display>
        {product.short_description ? (
          <Body muted size="sm" style={styles.desc} numberOfLines={2}>
            {product.short_description}
          </Body>
        ) : null}
        <View style={styles.priceRow}>
          <Price size="lg">{formatPrice(product.price)}</Price>
          {pct > 0 ? (
            <Body muted size="sm" style={styles.mrp}>
              {formatPrice(product.mrp)}
            </Body>
          ) : null}
          <View style={styles.viewPiece}>
            <Label style={styles.viewPieceText}>View piece</Label>
            <Ionicons name="arrow-redo" size={12} color={colors.light.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  imageWrap: {
    width: "100%",
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: colors.light.muted,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    backgroundColor: colors.light.muted,
  },
  stampRow: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  stamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  stampText: {
    fontSize: 9,
    color: colors.light.foreground,
  },
  discountBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  discountText: {
    color: "#fff",
    fontSize: 9,
  },
  body: {
    padding: spacing[5],
    gap: spacing[1],
  },
  kicker: {
    color: colors.light.primary,
    marginBottom: spacing[1],
  },
  brand: {
    color: colors.light.mutedForeground,
    marginBottom: spacing[1],
  },
  name: {
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  desc: {
    marginTop: spacing[1],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
    flexWrap: "wrap",
  },
  mrp: {
    textDecorationLine: "line-through",
  },
  viewPiece: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewPieceText: {
    color: colors.light.primary,
  },
});
