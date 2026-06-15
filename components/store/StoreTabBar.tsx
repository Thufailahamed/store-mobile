import React from "react";
import { ScrollView, StyleSheet, View, Pressable, Text } from "react-native";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export type StoreTab = "featured" | "products" | "reviews";

interface StoreTabBarProps {
  active: StoreTab;
  onChange: (tab: StoreTab) => void;
  productCount: number;
  reviewCount: number;
}

export function StoreTabBar({ active, onChange, productCount, reviewCount }: StoreTabBarProps) {
  const tabs: { id: StoreTab; label: string }[] = [
    { id: "featured", label: "FEATURED" },
    { id: "products", label: `PRODUCTS · ${productCount}` },
    { id: "reviews", label: `REVIEWS · ${reviewCount}` },
  ];

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {tabs.map((t) => {
          const selected = active === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[styles.pill, selected ? styles.pillActive : styles.pillIdle]}
            >
              <Text style={[styles.pillText, selected ? styles.pillTextActive : styles.pillTextIdle]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing[4],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[2],
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.full,
  },
  pillActive: {
    backgroundColor: colors.olive[700],
  },
  pillIdle: {
    backgroundColor: colors.light.secondary,
  },
  pillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  pillTextActive: {
    color: "#fff",
  },
  pillTextIdle: {
    color: colors.light.foreground,
  },
});
