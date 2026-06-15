import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

interface ProgressBarProps {
  value: number; // 0-100
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  value,
  height = 3,
  trackColor = colors.light.border,
  fillColor = colors.light.primary,
  style,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, height, backgroundColor: fillColor, borderRadius: radii.full },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    borderRadius: radii.full,
    overflow: "hidden",
  },
  fill: {},
});
