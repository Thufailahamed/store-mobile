import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Body, Display, MonoLabel } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface StoreRatingSummaryProps {
  avg: number;
  total: number;
  breakdown: Record<number, number>;
}

export function StoreRatingSummary({ avg, total, breakdown }: StoreRatingSummaryProps) {
  const max = Math.max(1, ...Object.values(breakdown).map((v) => v || 0));
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Display size="4xl" style={styles.avg}>{avg ? avg.toFixed(1) : "—"}</Display>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= Math.round(avg) ? "star" : "star-outline"}
              size={14}
              color={colors.accent2.ochre}
            />
          ))}
        </View>
        <Body size="xs" muted style={styles.totalLabel}>
          {total} verified reviews
        </Body>
      </View>
      <View style={styles.right}>
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = breakdown[stars] ?? 0;
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <View key={stars} style={styles.barRow}>
              <MonoLabel style={styles.starLabel}>{stars}</MonoLabel>
              <Ionicons name="star" size={9} color={colors.olive[600]} />
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              <Body size="xs" style={styles.barCount}>{count}</Body>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}10`,
    gap: spacing[5],
    ...shadows.soft,
  },
  left: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingRight: spacing[4],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.light.border,
  },
  avg: {
    fontFamily: fontFamilies.display.regular,
    color: colors.light.foreground,
    lineHeight: 44,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  totalLabel: {
    marginTop: 2,
  },
  right: {
    flex: 1,
    gap: 5,
    justifyContent: "center",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starLabel: {
    width: 8,
    fontSize: 9,
    color: colors.light.mutedForeground,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: `${colors.olive[600]}15`,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.olive[600],
    borderRadius: 3,
  },
  barCount: {
    width: 22,
    textAlign: "right",
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
});
