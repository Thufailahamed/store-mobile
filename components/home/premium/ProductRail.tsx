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
  /** Small disclosure pill (e.g. "Sponsored") shown on every card in the rail. */
  badgeLabel?: string;
  /** "feature" uses the larger card size for curated rails (e.g. Editor's picks). */
  variant?: "default" | "feature";
}

export function ProductRail({
  title,
  products,
  onSeeAll,
  showSaleBadge,
  kicker,
  accent,
  badgeLabel,
  variant = "default",
}: ProductRailProps) {
  const list = products.slice(0, 12);
  if (!list.length) return null;
  const isFeature = variant === "feature";

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title={title} onPress={onSeeAll} kicker={kicker} accent={accent} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((p, i) => (
          <HomeProductCard
            key={p.id}
            product={p}
            showSaleBadge={showSaleBadge}
            index={i}
            badgeLabel={badgeLabel}
            size={isFeature ? "large" : "default"}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
});
