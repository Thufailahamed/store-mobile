import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { HomeProductCard } from "./HomeProductCard";
import { spacing } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

const STAGGER = spacing[8];

interface MasonryProductRailProps {
  title: string;
  products: Product[];
  onSeeAll?: () => void;
  kicker?: string;
  showSaleBadge?: boolean;
}

/**
 * A staggered, alternating-height rail — every other card sits lower than
 * its neighbour — so this rail reads as a distinct "browse" moment instead
 * of the same aligned grid as the plain listing rails.
 */
export function MasonryProductRail({
  title,
  products,
  onSeeAll,
  kicker,
  showSaleBadge = false,
}: MasonryProductRailProps) {
  const list = products.slice(0, 12);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader title={title} onPress={onSeeAll} kicker={kicker} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((p, i) => (
          <View key={p.id} style={i % 2 === 1 ? styles.stagger : undefined}>
            <HomeProductCard product={p} index={i} showSaleBadge={showSaleBadge} />
          </View>
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
    paddingBottom: STAGGER,
    gap: spacing[3],
    alignItems: "flex-start",
  },
  stagger: {
    marginTop: STAGGER,
  },
});
