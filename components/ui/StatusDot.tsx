import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme/tokens";

interface StatusDotProps {
  tone?: "live" | "success" | "warning" | "danger" | "muted" | "info";
  pulse?: boolean;
  size?: number;
  style?: ViewStyle;
}

const toneColor: Record<NonNullable<StatusDotProps["tone"]>, string> = {
  live: colors.olive[500],
  success: colors.olive[500],
  warning: "#c8a44a",
  danger: colors.light.destructive,
  muted: colors.light.muted,
  info: colors.light.primary,
};

export function StatusDot({ tone = "info", size = 8, style }: StatusDotProps) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: toneColor[tone] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
