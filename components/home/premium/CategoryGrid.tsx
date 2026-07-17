import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

const COLUMNS = 3;
const H_PAD = spacing[5];
const GAP = spacing[3];

interface CategoryGridProps {
  categories: Category[];
}

/**
 * Static (non-scrolling) grid of square category tiles — a second, more
 * visual browse entry point further down Home, separate from the plain-text
 * CategoryScroller strip at the top.
 */
export function CategoryGrid({ categories }: CategoryGridProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - H_PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const list = categories.slice(0, 9);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Browse by category"
        onPress={() => router.push("/(main)/categories")}
      />
      <View style={styles.grid}>
        {list.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.tile, { width: tileWidth }]}
            activeOpacity={0.85}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          >
            <View style={styles.imageWrap}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Text style={styles.placeholderInitial}>{c.name.charAt(0)}</Text>
                </View>
              )}
            </View>
            <View style={styles.labelWrap}>
              <Text style={styles.label} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: H_PAD,
    columnGap: GAP,
    rowGap: GAP,
  },
  tile: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  imageWrap: {
    aspectRatio: 1,
    width: "100%",
    backgroundColor: colors.olive[100],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.olive[600],
  },
  labelWrap: {
    paddingVertical: spacing[2],
    alignItems: "center",
    backgroundColor: colors.light.muted,
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    textAlign: "center",
  },
});
