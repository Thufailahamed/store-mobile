import React, { useEffect, useRef } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

const TILE = 64;

interface CategoryScrollerProps {
  categories: Category[];
}

/**
 * Home's single category entry point — a horizontal row of round image
 * tiles with a trailing "All" tile. Replaces the old text strip + the
 * 3×3 CategoryGrid further down, which showed the same categories twice.
 */
export function CategoryScroller({ categories }: CategoryScrollerProps) {
  const router = useRouter();
  const list = categories.slice(0, 12);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!list.length) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, list.length]);

  if (!list.length) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          >
            <View style={styles.circle}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={styles.image} contentFit="cover" transition={200} />
              ) : (
                <Text style={styles.initial}>{c.name.charAt(0)}</Text>
              )}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.item}
          activeOpacity={0.7}
          onPress={() => router.push("/(main)/categories")}
        >
          <View style={[styles.circle, styles.allCircle]}>
            <Ionicons name="grid-outline" size={22} color={colors.olive[700]} />
          </View>
          <Text style={styles.label}>All</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  item: {
    width: TILE + 8,
    alignItems: "center",
    gap: 6,
  },
  circle: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: colors.light.border + "99",
    alignItems: "center",
    justifyContent: "center",
  },
  allCircle: {
    backgroundColor: colors.olive[50],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  initial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.olive[700],
  },
  label: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.foreground,
    textAlign: "center",
  },
});
