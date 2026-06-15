import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface PinnedDropProps {
  products: Product[];
  endsAt?: string;
}

export function PinnedDrop({ products, endsAt }: PinnedDropProps) {
  const router = useRouter();
  const items = products.slice(0, 5);
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = endsAt || new Date(Date.now() + 6 * 3600_000).toISOString();
    const tick = () => {
      const remain = new Date(target).getTime() - Date.now();
      if (remain <= 0) {
        setT({ h: 0, m: 0, s: 0 });
        return;
      }
      const h = Math.floor(remain / 3600_000);
      const m = Math.floor((remain % 3600_000) / 60_000);
      const s = Math.floor((remain % 60_000) / 1000);
      setT({ h, m, s });
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [endsAt]);

  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      {/* Background ornaments */}
      <View style={styles.halftone} pointerEvents="none" />
      <View style={[styles.glow, styles.glowA]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowB]} pointerEvents="none" />

      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>The Drop · Limited · 05</Label>
          </View>
          <Display size="3xl" style={styles.title}>
            Five pieces.{" "}
            <Display italic size="3xl" style={styles.titleAccent}>
              Six hours.
            </Display>
          </Display>
          <Body style={styles.subtitle}>
            When the clock ticks down, the page closes. No restocks, no shadow
            inventory — what's here is all there is.
          </Body>
        </View>

        {/* Countdown card */}
        <View style={styles.countdownCard}>
          <Label style={styles.countdownLabel}>Closes in</Label>
          <View style={styles.countdownRow}>
            <Unit value={t.h} label="Hrs" />
            <Display size="3xl" style={styles.countdownColon}>:</Display>
            <Unit value={t.m} label="Min" />
            <Display size="3xl" style={styles.countdownColon}>:</Display>
            <Unit value={t.s} label="Sec" />
          </View>
        </View>

        {/* Products */}
        <View style={styles.grid}>
          {items.map((p, i) => (
            <DropCard
              key={p.id}
              product={p}
              index={i}
              onPress={() => router.push(`/(main)/products/${p.slug}`)}
            />
          ))}
        </View>

        {/* Footer */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.footerLink}
          onPress={() => router.push("/(main)/products?sort=sale")}
        >
          <View style={styles.footerRule} />
          <Label style={styles.footerLinkText}>See the rest of the drop</Label>
          <Ionicons name="arrow-up" size={12} color={colors.olive[300]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.unit}>
      <Display size="2xl" style={styles.unitValue}>
        {String(value).padStart(2, "0")}
      </Display>
      <Label style={styles.unitLabel}>{label}</Label>
    </View>
  );
}

function DropCard({
  product,
  index,
  onPress,
}: {
  product: Product;
  index: number;
  onPress: () => void;
}) {
  const img = product.images?.[0]?.url;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.card}>
      <Label style={styles.cardIndex}>Nº {String(index + 1).padStart(2, "0")}</Label>
      <View style={styles.cardImageWrap}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : null}
        <View style={styles.cardImageTint} />
        {discount > 0 ? (
          <View style={styles.sticker}>
            <Display size="lg" style={styles.stickerText}>
              {discount}%
            </Display>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Label style={styles.cardBrand} numberOfLines={1}>
          {product.brand?.name ?? "House pick"}
        </Label>
        <Body size="sm" style={styles.cardName} numberOfLines={2}>
          {product.name}
        </Body>
        <View style={styles.cardPriceRow}>
          <Price size="sm">{formatPrice(product.price)}</Price>
          {discount > 0 ? (
            <Label style={styles.cardOff}>−{discount}%</Label>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
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
  halftone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168, 176, 107, 0.08)",
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowA: {
    top: -80,
    left: -80,
    backgroundColor: "rgba(104, 118, 57, 0.35)",
  },
  glowB: {
    bottom: -120,
    right: -80,
    backgroundColor: "rgba(168, 176, 107, 0.25)",
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: spacing[10],
    paddingBottom: spacing[8],
    gap: spacing[6],
  },
  header: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.olive[300] },
  kickerText: { color: colors.olive[300] },
  title: { color: colors.paper.cream, lineHeight: 34 },
  titleAccent: { color: colors.olive[300] },
  subtitle: { color: "rgba(245, 244, 239, 0.7)", maxWidth: 360 },
  // Countdown
  countdownCard: {
    borderWidth: 1,
    borderColor: "rgba(245, 244, 239, 0.22)",
    backgroundColor: "rgba(245, 244, 239, 0.05)",
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  countdownLabel: { color: colors.olive[300], marginBottom: spacing[2] },
  countdownRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  countdownColon: { color: "rgba(168, 176, 107, 0.7)", marginBottom: 4 },
  unit: { alignItems: "center", flex: 1 },
  unitValue: { color: colors.paper.cream, fontVariant: ["tabular-nums"] },
  unitLabel: { color: "rgba(245, 244, 239, 0.6)", fontSize: 10, marginTop: 2 },
  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  card: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  cardIndex: { color: colors.light.primary, fontSize: 10 },
  cardImageWrap: {
    height: 130,
    backgroundColor: colors.olive[100],
    borderRadius: radii.sm,
    overflow: "hidden",
    position: "relative",
  },
  cardImageTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.10)" },
  sticker: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
  },
  stickerText: { color: colors.paper.cream, fontSize: 14, lineHeight: 16 },
  cardBody: { gap: 2 },
  cardBrand: { color: colors.olive[600], fontSize: 9 },
  cardName: { color: colors.light.foreground, fontWeight: "600" },
  cardPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  cardOff: { color: colors.olive[600], fontSize: 9 },
  // Footer
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
  },
  footerRule: { width: 24, height: 1, backgroundColor: "rgba(245, 244, 239, 0.5)" },
  footerLinkText: { color: colors.paper.cream },
});
