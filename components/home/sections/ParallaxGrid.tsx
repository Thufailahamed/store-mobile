import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface ParallaxGridProps {
  products: Product[];
  kicker?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Editorial mosaic — 5 product + 2 editorial (quote + spec) cells.
 * Spans keep the layout asymmetric: one tall hero on the left, the rest
 * vary in size. Editorial cells slot in to break up product photos so
 * the grid reads like a magazine spread.
 */
export function ParallaxGrid({
  products,
  kicker = "Lookbook · 2D",
  title = "A grid that breathes.",
  subtitle = "Every card moves at its own pace. The page is alive.",
}: ParallaxGridProps) {
  const router = useRouter();
  const items = products.slice(0, 5);
  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.halftone} pointerEvents="none" />
      <View style={[styles.glow, styles.glowA]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowB]} pointerEvents="none" />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
            </View>
            <Display size="3xl" style={styles.title}>
              {splitTitle(title)}
            </Display>
          </View>
          {subtitle ? (
            <Body style={styles.subtitle} size="sm">
              {subtitle}
            </Body>
          ) : null}
        </View>

        <View style={styles.grid}>
          {/* Row 1: tall + wide + narrow */}
          <View style={styles.row}>
            <ProductCell
              product={items[0]}
              span="tall"
              isFeature
              onPress={() => router.push(`/(main)/products/${items[0].slug}`)}
            />
            <View style={styles.col}>
              <ProductCell
                product={items[1]}
                span="wide"
                onPress={() => router.push(`/(main)/products/${items[1].slug}`)}
              />
              <View style={styles.gapH} />
              <ProductCell
                product={items[2]}
                span="wide"
                onPress={() => router.push(`/(main)/products/${items[2].slug}`)}
              />
            </View>
          </View>

          {/* Row 2: editorial quote + spec */}
          <View style={[styles.row, { marginTop: spacing[3] }]}>
            <QuoteCell />
            <View style={styles.gapW} />
            <SpecCell />
          </View>

          {/* Row 3: two products + wide */}
          {items[3] ? (
            <View style={[styles.row, { marginTop: spacing[3] }]}>
              <View style={styles.col}>
                <ProductCell
                  product={items[3]}
                  span="wide"
                  onPress={() => router.push(`/(main)/products/${items[3].slug}`)}
                />
              </View>
              <View style={styles.gapW} />
              <View style={styles.col}>
                {items[4] ? (
                  <ProductCell
                    product={items[4]}
                    span="wide"
                    onPress={() => router.push(`/(main)/products/${items[4].slug}`)}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Label style={styles.footerText}>05 looks · 1 mood</Label>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.footerLink}
            onPress={() => router.push("/(main)/products")}
          >
            <View style={styles.footerRule} />
            <Label style={styles.footerLinkText}>See the full lookbook</Label>
            <Ionicons name="arrow-up" size={11} color={colors.olive[300]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function splitTitle(t: string) {
  const parts = t.split(" ");
  if (parts.length < 2) return t;
  const last = parts.pop()!;
  return (
    <>
      {parts.join(" ")}{" "}
      <Display italic size="3xl" style={styles.titleAccent}>
        {last}
      </Display>
    </>
  );
}

function ProductCell({
  product,
  span,
  isFeature = false,
  onPress,
}: {
  product: Product;
  span: "tall" | "wide" | "narrow" | "full";
  isFeature?: boolean;
  onPress: () => void;
}) {
  const img = product.images?.[0]?.url;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.cell,
        span === "tall" && styles.cellTall,
        span === "wide" && styles.cellWide,
        span === "narrow" && styles.cellNarrow,
      ]}
    >
      <View style={[styles.cellImageWrap, span === "tall" && styles.cellTallImageWrap]}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
        ) : null}
        <View style={styles.cellImageTint} />
        <View style={styles.lookChip}>
          <Label style={styles.lookChipText}>
            <Label style={styles.lookDot}>● </Label>Look
          </Label>
        </View>
        <View style={styles.cellArrow}>
          <Ionicons name="arrow-up" size={12} color={colors.paper.cream} />
        </View>
      </View>
      <View style={styles.cellBody}>
        <Label style={styles.cellBrand} numberOfLines={1}>
          {product.brand?.name ?? "House pick"}
        </Label>
        <Body size="sm" style={styles.cellName} numberOfLines={1}>
          {product.name}
        </Body>
        <View style={styles.cellPriceRow}>
          <Price size="sm">{formatPrice(product.price)}</Price>
          {discount > 0 ? <Label style={styles.cellOff}>−{discount}%</Label> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function QuoteCell() {
  return (
    <View style={[styles.cellEditorial, styles.quoteCell]}>
      <Label style={styles.editorialKicker}>Field note · 03</Label>
      <Display italic size="xl" style={styles.quoteBody}>
        "The best cloth gets out of the way. You only notice it once you take
        it off."
      </Display>
      <View style={styles.quoteFooter}>
        <Label style={styles.quoteFooterText}>— Atelier, Lisbon</Label>
        <View style={styles.editorialRule} />
      </View>
    </View>
  );
}

function SpecCell() {
  return (
    <View style={[styles.cellEditorial, styles.specCell]}>
      <View style={styles.specHeader}>
        <Label style={styles.editorialKicker}>Spec sheet</Label>
        <Label style={styles.editorialKicker}>04 / 07</Label>
      </View>
      <View style={styles.specList}>
        {[
          ["Weave", "Garment-dyed linen"],
          ["Dye", "Olive · 80° fixed"],
          ["Run", "120 pieces · archive"],
          ["Origin", "Atelier, Lisbon"],
        ].map(([k, v]) => (
          <View key={k} style={styles.specRow}>
            <Label style={styles.specKey}>{k}</Label>
            <Body size="sm" style={styles.specVal}>
              {v}
            </Body>
          </View>
        ))}
      </View>
      <View style={styles.specFooter}>
        <Label style={styles.specFooterText}>Hand-finished</Label>
        <View style={styles.specOrnament}>
          <Label style={styles.specOrnamentText}>✺</Label>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.olive[950],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(245, 244, 239, 0.18)",
    overflow: "hidden",
    position: "relative",
  },
  halftone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(168, 176, 107, 0.06)" },
  glow: { position: "absolute", width: 280, height: 280, borderRadius: 140 },
  glowA: { top: -60, left: 40, backgroundColor: "rgba(168, 176, 107, 0.18)" },
  glowB: { bottom: -80, right: -40, backgroundColor: "rgba(232, 220, 170, 0.10)" },
  inner: { paddingHorizontal: 20, paddingTop: spacing[10], paddingBottom: spacing[8] },
  header: { marginBottom: spacing[6], gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.olive[300] },
  kickerText: { color: colors.olive[300] },
  title: { color: colors.paper.cream, lineHeight: 34 },
  titleAccent: { color: colors.olive[300] },
  subtitle: { color: "rgba(245, 244, 239, 0.7)" },
  // Grid
  grid: { gap: 0 },
  row: { flexDirection: "row" },
  col: { flex: 1 },
  gapH: { height: spacing[3] },
  gapW: { width: spacing[3] },
  // Product cell
  cell: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii.md,
    overflow: "hidden",
    flex: 1,
  },
  cellTall: { minHeight: 360, marginRight: spacing[3] },
  cellWide: { minHeight: 170, flex: 1 },
  cellNarrow: { minHeight: 170, flex: 0, width: 120 },
  cellImageWrap: {
    height: 110,
    backgroundColor: colors.olive[100],
    position: "relative",
  },
  cellTallImageWrap: {
    height: 280,
  },
  cellImageTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.20)" },
  lookChip: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  lookChipText: { color: colors.olive[800], fontSize: 9 },
  lookDot: { color: colors.olive[600] },
  cellArrow: {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  cellBody: { padding: spacing[3], gap: 2 },
  cellBrand: { color: colors.olive[600], fontSize: 9 },
  cellName: { color: colors.light.foreground, fontWeight: "600" },
  cellPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  cellOff: { color: colors.olive[600], fontSize: 9 },
  // Editorial cells
  cellEditorial: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing[4],
    gap: spacing[2],
  },
  quoteCell: {
    backgroundColor: colors.olive[700],
    minHeight: 200,
    justifyContent: "space-between",
    marginRight: spacing[3],
  },
  quoteBody: { color: colors.paper.cream, lineHeight: 24 },
  quoteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quoteFooterText: { color: "rgba(245, 244, 239, 0.7)" },
  editorialRule: { width: 36, height: 1, backgroundColor: colors.olive[300] },
  specCell: {
    backgroundColor: colors.paper.cream,
    minHeight: 200,
  },
  specHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editorialKicker: { color: colors.olive[700], fontSize: 9 },
  specList: { gap: 6, marginTop: 4 },
  specRow: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  specKey: { color: colors.light.mutedForeground, fontSize: 9, width: 50 },
  specVal: { color: colors.light.foreground, fontSize: 12, fontWeight: "600" },
  specFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  specFooterText: { color: colors.light.mutedForeground, fontSize: 9 },
  specOrnament: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  specOrnamentText: { color: colors.paper.cream, fontSize: 12 },
  // Footer
  footer: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 244, 239, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { color: "rgba(245, 244, 239, 0.5)" },
  footerLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerRule: { width: 24, height: 1, backgroundColor: "rgba(245, 244, 239, 0.5)" },
  footerLinkText: { color: colors.paper.cream },
});
