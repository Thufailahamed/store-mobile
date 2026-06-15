import React from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Display, Label } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

interface TodaysEditProps {
  products: Product[];
  kicker?: string;
  title?: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export function TodaysEdit({
  products,
  title = "Featured",
  onSeeAll,
}: TodaysEditProps) {
  const router = useRouter();
  if (!products.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Display size="lg" style={styles.title}>
          {title}
        </Display>
        {onSeeAll ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll} style={styles.seeAllBtn}>
            <Label style={styles.seeAllText}>See All &gt;</Label>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} horizontal />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing[5],
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: spacing[4],
  },
  title: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
  },
  seeAllBtn: {
    paddingVertical: 4,
  },
  seeAllText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    textTransform: "none",
  },
  scroll: {
    paddingHorizontal: 20,
    gap: spacing[2],
  },
});
