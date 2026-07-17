import React, { useEffect, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing, useWindowDimensions } from "react-native";
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
        {list.map((c, i) => (
          <CategoryTile
            key={c.id}
            category={c}
            index={i}
            width={tileWidth}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          />
        ))}
      </View>
    </View>
  );
}

/** Fades + scales in on mount, staggered by index (row by row), instead of the whole grid popping in at once. */
function CategoryTile({
  category,
  index,
  width,
  onPress,
}: {
  category: Category;
  index: number;
  width: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.tile, { width }]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.imageWrap}>
          {category.image_url ? (
            <Image source={{ uri: category.image_url }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderInitial}>{category.name.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.labelWrap}>
          <Text style={styles.label} numberOfLines={1}>
            {category.name}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
