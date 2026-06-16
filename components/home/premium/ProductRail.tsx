import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { HomeProductCard } from "./HomeProductCard";
import { spacing } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

interface ProductRailProps {
  title: string;
  products: Product[];
  onSeeAll?: () => void;
  showSaleBadge?: boolean;
  kicker?: string;
  accent?: boolean;
}

export function ProductRail({
  title,
  products,
  onSeeAll,
  showSaleBadge,
  kicker,
  accent,
}: ProductRailProps) {
  const list = products.slice(0, 12);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title={title} onPress={onSeeAll} kicker={kicker} accent={accent} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((p) => (
          <HomeProductCard key={p.id} product={p} showSaleBadge={showSaleBadge} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[6],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
});
