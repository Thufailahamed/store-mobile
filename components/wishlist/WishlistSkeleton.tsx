import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/hooks/useTheme";
import { Skeleton } from "@/components/ui";
import { spacing, radii } from "@/lib/theme/tokens";
import { WISHLIST_CARD_WIDTH, WISHLIST_GRID_GAP } from "@/components/wishlist/layout";

export function WishlistSkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Skeleton
            width="100%"
            height={WISHLIST_CARD_WIDTH * 0.78}
            borderRadius={0}
            style={{ borderTopLeftRadius: radii["2xl"], borderTopRightRadius: radii["2xl"] }}
          />
          <View style={{ padding: 12, gap: 8 }}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="90%" height={16} />
            <Skeleton width="60%" height={16} />
            <View style={styles.row}>
              <Skeleton width={70} height={18} />
              <Skeleton width={32} height={32} borderRadius={16} />
            </View>
          </View>
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
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
});
