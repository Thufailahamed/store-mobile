import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { ProgressBar } from "./ProgressBar";

interface StatTileProps {
  label: string; // mono label
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  progress?: number; // 0-100
  tone?: "default" | "accent" | "warn";
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
}

const toneColor: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: colors.light.primary,
  accent: colors.olive[300],
  warn: colors.light.destructive,
};

export function StatTile({
  label,
  value,
  sub,
  trend,
  trendLabel,
  progress,
  tone = "default",
  size = "md",
  style,
}: StatTileProps) {
  return (
    <View style={[styles.tile, size === "lg" && styles.tileLg, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, size === "lg" && styles.valueLg]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {progress !== undefined ? (
        <View style={styles.progressWrap}>
          <ProgressBar value={progress} fillColor={toneColor[tone]} />
        </View>
      ) : null}
      {trend ? (
        <View style={styles.trendRow}>
          <Text
            style={[
              styles.trend,
              trend === "up" && { color: colors.olive[500] },
              trend === "down" && { color: colors.light.destructive },
              trend === "neutral" && { color: colors.light.mutedForeground },
            ]}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}{" "}
            {trendLabel ?? ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 20,
    gap: 6,
    minHeight: 110,
    justifyContent: "space-between",
  },
  tileLg: {
    minHeight: 180,
    padding: 24,
    ...shadows.soft,
  },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes["3xl"],
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
  },
  valueLg: {
    fontSize: typography.fontSizes["5xl"],
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  progressWrap: { marginTop: 8 },
  trendRow: { marginTop: 4 },
  trend: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
});
