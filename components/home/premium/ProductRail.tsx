import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { HomeProductCard } from "./HomeProductCard";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
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
  /**
   * "feature" lifts the rail into a tinted, larger-card editorial panel for
   * curated/spotlight sections (e.g. Editor's picks) instead of the plain
   * listing look used for catalog rails (e.g. On sale, New arrivals).
   */
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
    <View style={[styles.wrap, isFeature && styles.wrapFeature]}>
      <HomeSectionHeader
        title={title}
        onPress={onSeeAll}
        kicker={kicker}
        accent={accent}
        variant={variant}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isFeature && styles.scrollFeature]}
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
  wrapFeature: {
    marginHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    backgroundColor: colors.olive[50],
    borderRadius: radii["2xl"],
    ...shadows.soft,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  scrollFeature: {
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
});
