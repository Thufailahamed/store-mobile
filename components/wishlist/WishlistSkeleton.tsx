import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { spacing, radii } from "@/lib/theme/tokens";
import { WISHLIST_CARD_WIDTH, WISHLIST_GRID_GAP, WISHLIST_IMAGE_HEIGHT } from "@/components/wishlist/layout";

export function WishlistSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <Skeleton width="100%" height={WISHLIST_IMAGE_HEIGHT} borderRadius={0} />
          <View style={styles.body}>
            <Skeleton width="45%" height={8} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="55%" height={12} />
          </View>
          <Skeleton width="100%" height={40} borderRadius={0} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: WISHLIST_GRID_GAP,
    paddingTop: spacing[2],
  },
  card: {
    width: WISHLIST_CARD_WIDTH,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#ffffff",
  },
  body: {
    padding: 10,
    gap: 8,
  },
});
