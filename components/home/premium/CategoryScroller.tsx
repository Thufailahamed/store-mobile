import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

const CIRCLE = 68;

function categoryIcon(slug: string, name: string): keyof typeof Ionicons.glyphMap {
  const key = `${slug} ${name}`.toLowerCase();
  if (key.includes("women") || key.includes("dress")) return "woman-outline";
  if (key.includes("men") || key.includes("shoe")) return "man-outline";
  if (key.includes("kid")) return "happy-outline";
  if (key.includes("travel")) return "airplane-outline";
  if (key.includes("fragrance") || key.includes("perfume")) return "flask-outline";
  if (key.includes("accessor") || key.includes("glass")) return "glasses-outline";
  if (key.includes("bag") || key.includes("handbag")) return "bag-outline";
  if (key.includes("jewel")) return "diamond-outline";
  if (key.includes("home") || key.includes("living")) return "home-outline";
  if (key.includes("beauty") || key.includes("skin")) return "sparkles-outline";
  if (key.includes("watch")) return "watch-outline";
  return "shirt-outline";
}

interface CategoryScrollerProps {
  categories: Category[];
}

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
        {list.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.item}
            activeOpacity={0.8}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          >
            <View style={styles.circle}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={styles.circleImage} contentFit="cover" />
              ) : (
                <Ionicons
                  name={categoryIcon(c.slug, c.name)}
                  size={26}
                  color={colors.light.foreground}
                />
              )}
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {c.name}
            </Text>
          </TouchableOpacity>
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
    gap: spacing[4],
  },
  item: {
    width: CIRCLE + 8,
    alignItems: "center",
    gap: spacing[2],
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  circleImage: {
    width: "100%",
    height: "100%",
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    textAlign: "center",
    lineHeight: 15,
  },
});
