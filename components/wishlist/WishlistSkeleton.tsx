import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useTheme } from "@/lib/hooks/useTheme";
import { Skeleton } from "@/components/ui";
import { spacing, radii } from "@/lib/theme/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;

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
            height={CARD_WIDTH * 0.78}
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
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
});
