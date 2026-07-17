import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

interface CategoryScrollerProps {
  categories: Category[];
}

/**
 * Plain text browse strip — deliberately no images/icons/card chrome so it
 * reads as quick top-level navigation (Men, Women, Kids…), distinct from the
 * image-led CategoryGrid section further down the page.
 */
export function CategoryScroller({ categories }: CategoryScrollerProps) {
  const router = useRouter();
  const list = categories.slice(0, 12);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Shop by category"
        onPress={() => router.push("/(main)/categories")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((c, i) => (
          <View key={c.id} style={styles.itemRow}>
            <TouchableOpacity activeOpacity={0.6} onPress={() => router.push(`/(main)/products?category=${c.slug}`)}>
              <Text style={styles.label}>{c.name}</Text>
            </TouchableOpacity>
            {i < list.length - 1 ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    alignItems: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.border,
    marginHorizontal: spacing[1],
  },
});
