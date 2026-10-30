import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import { INK, CREAM } from "./primitives";

type Props = {
  name: string;
  shortDescription: string;
  brandName?: string;
  price: number;
  mrp: number;
  imageUri?: string;
  swatches: string[];
  sizes: string[];
  stock: number;
  isFeatured?: boolean;
};

/** Mirrors the storefront product card so sellers see what shoppers will see. */
export function ProductPreviewCard({
  name,
  shortDescription,
  brandName,
  price,
  mrp,
  imageUri,
  swatches,
  sizes,
  stock,
  isFeatured,
}: Props) {
  const pct = mrp > price && price > 0 ? discountPct(mrp, price) : 0;
  const soldOut = stock <= 0;
  return (
    <View style={styles.wrap} accessibilityLabel="Storefront card preview">
      <View style={styles.card}>
        <View style={styles.media}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="bag-handle-outline" size={34} color="rgba(22,23,15,0.35)" />
              <Text style={styles.placeholderText}>NO IMAGE YET</Text>
            </View>
          )}
          {imageUri ? (
            <LinearGradient
              colors={["transparent", "rgba(22,23,15,0.5)"]}
              style={styles.scrim}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.heart}>
            <Ionicons name="heart-outline" size={15} color={INK} />
          </View>
          <View style={styles.badges}>
            {soldOut ? (
              <Text style={[styles.badge, styles.badgeDark]}>SOLD OUT</Text>
            ) : pct > 0 ? (
              <Text style={styles.badge}>−{pct}%</Text>
            ) : null}
            {isFeatured ? (
              <Text style={[styles.badge, styles.badgeGold]}>FEATURED</Text>
            ) : null}
          </View>
          <View style={styles.addBag}>
            <Ionicons name="add" size={13} color={INK} />
            <Text style={styles.addBagText}>ADD TO BAG</Text>
          </View>
        </View>
        <View style={styles.info}>
          {brandName ? (
            <Text style={styles.brand} numberOfLines={1}>
              {brandName.toUpperCase()}
            </Text>
          ) : null}
          <Text style={[styles.name, !name && styles.nameEmpty]} numberOfLines={2}>
            {name || "Product name"}
          </Text>
          {shortDescription ? (
            <Text style={styles.short} numberOfLines={1}>
              {shortDescription}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price > 0 ? formatPrice(price) : "LKR —"}</Text>
            {pct > 0 ? <Text style={styles.mrp}>{formatPrice(mrp)}</Text> : null}
          </View>
          <View style={styles.metaRow}>
            {swatches.length > 0 ? (
              <View style={styles.swatches}>
                {swatches.slice(0, 5).map((hex, i) => (
                  <View key={`${hex}-${i}`} style={[styles.swatch, { backgroundColor: hex, marginLeft: i ? -4 : 0 }]} />
                ))}
              </View>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {[
                swatches.length ? `${swatches.length} colour${swatches.length === 1 ? "" : "s"}` : null,
                sizes.length ? `${sizes.length} size${sizes.length === 1 ? "" : "s"}` : null,
                `${stock} in stock`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  card: {
    width: "72%",
    maxWidth: 280,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.06)",
    shadowColor: "#2a2c1f",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  media: { aspectRatio: 3 / 4, backgroundColor: colors.olive[50] },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 40 },
  placeholderText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, letterSpacing: 1.4, color: "rgba(22,23,15,0.4)" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%" },
  heart: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(250,248,241,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  badges: { position: "absolute", top: 10, right: 10, alignItems: "flex-end", gap: 5 },
  badge: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: INK,
    backgroundColor: "rgba(250,248,241,0.94)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  badgeDark: { backgroundColor: INK, color: CREAM },
  badgeGold: { backgroundColor: colors.accent2.ochre, color: INK },
  addBag: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  addBagText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, letterSpacing: 1.4, color: INK },
  info: { padding: 12, gap: 3 },
  brand: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.ink.mute },
  name: { fontFamily: fontFamilies.display.semibold, fontSize: 15, lineHeight: 19, color: INK },
  nameEmpty: { color: "rgba(22,23,15,0.3)" },
  short: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 4 },
  price: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK, fontVariant: ["tabular-nums"] },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  swatches: { flexDirection: "row" },
  swatch: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: "#FFFFFF" },
  meta: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 10.5, color: colors.ink.mute },
});
