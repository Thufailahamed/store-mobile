import React, { useEffect, useRef } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

interface CategoryScrollerProps {
  categories: Category[];
}

/**
 * Plain text browse strip — no heading, no images/icons/card chrome, just
 * quick top-level navigation (Men, Women, Kids…), distinct from the
 * image-led CategoryGrid section further down the page.
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
        {list.map((c, i) => (
          <View key={c.id} style={styles.itemRow}>
            <TouchableOpacity activeOpacity={0.6} onPress={() => router.push(`/(main)/products?category=${c.slug}`)}>
              <Text style={styles.label}>{c.name}</Text>
            </TouchableOpacity>
            {i < list.length - 1 ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </ScrollView>
    </Animated.View>
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
