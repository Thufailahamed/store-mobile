import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface BrandStatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "accent" | "warn";
  style?: ViewStyle;
}

const toneColor: Record<NonNullable<BrandStatCardProps["tone"]>, string> = {
  default: colors.light.primary,
  accent: colors.olive[500],
  warn: colors.light.destructive,
};

export function BrandStatCard({ label, value, sub, tone = "default", style }: BrandStatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
});
