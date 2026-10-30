import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
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
    <LinearGradient
      colors={[colors.olive[900], colors.olive[950]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <View style={styles.left}>
        <Display size="4xl" style={styles.avg}>{total > 0 ? avg.toFixed(1) : "New"}</Display>
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
          {total} review{total === 1 ? "" : "s"}
        </Body>
      </View>
      <View style={styles.right}>
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = breakdown[stars] ?? 0;
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <View key={stars} style={styles.barRow}>
              <MonoLabel style={styles.starLabel}>{stars}</MonoLabel>
              <Ionicons name="star" size={9} color={colors.accent2.ochre} />
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              <Body size="xs" style={styles.barCount}>{count}</Body>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: spacing[4],
    borderRadius: 26,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
    gap: spacing[5],
    ...shadows.editorial,
  },
  left: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingRight: spacing[4],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(250,248,241,0.15)",
  },
  avg: {
    fontFamily: fontFamilies.display.regular,
    color: colors.paper.cream,
    lineHeight: 48,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  totalLabel: {
    marginTop: 2,
    color: "rgba(250,248,241,0.6)",
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
    color: "rgba(250,248,241,0.6)",
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(250,248,241,0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.accent2.ochre,
    borderRadius: 3,
  },
  barCount: {
    width: 22,
    textAlign: "right",
    fontSize: 10,
    color: "rgba(250,248,241,0.7)",
  },
});
