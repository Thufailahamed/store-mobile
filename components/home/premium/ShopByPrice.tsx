import React from "react";
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { spacing } from "@/lib/theme/tokens";

const GAP = spacing[3];
const H_PAD = spacing[5];

/**
 * Price bands. Each artwork is a square 1080×1080 card that carries its own
 * copy (tier, range, CTA), so the tile is image-only. Bounds match the
 * backend PRICE_BANDS (max exclusive; null = open-ended).
 */
const BANDS = [
  { key: "under-5k", min: 0, max: 5000, label: "Under 5K", art: require("@/assets/shop-by-price/essentials.webp") },
  { key: "5k-15k", min: 5000, max: 15000, label: "5K – 15K", art: require("@/assets/shop-by-price/everyday.webp") },
  { key: "15k-50k", min: 15000, max: 50000, label: "15K – 50K", art: require("@/assets/shop-by-price/elevated.webp") },
  { key: "50k-plus", min: 50000, max: null, label: "50K+", art: require("@/assets/shop-by-price/exclusive.webp") },
] as const;

/**
 * Shop by price — a 2×2 grid of budget-band artworks. Each tile deep-links
 * to the grid scoped to exactly that band.
 */
export function ShopByPrice() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tileW = (width - H_PAD * 2 - GAP) / 2;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker="Every budget, one standard" title="Shop by price" />
      <View style={styles.grid}>
        {BANDS.map((b) => {
          const qs = [`minPrice=${b.min}`];
          if (b.max != null) qs.push(`maxPrice=${b.max}`);
          return (
            <TouchableOpacity
              key={b.key}
              activeOpacity={0.9}
              onPress={() => router.push(`/(main)/products?${qs.join("&")}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${b.label}`}
              style={{ width: tileW, height: tileW }}
            >
              <Image source={b.art} style={styles.img} contentFit="cover" transition={250} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: H_PAD,
  },
  img: {
    width: "100%",
    height: "100%",
  },
});
