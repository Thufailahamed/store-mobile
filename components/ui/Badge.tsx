import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { AppText } from "./AppText";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: any }> = {
  default: {
    container: { backgroundColor: colors.light.primary },
    text: { color: colors.light.primaryForeground },
  },
  secondary: {
    container: { backgroundColor: colors.light.secondary },
    text: { color: colors.light.secondaryForeground },
  },
  destructive: {
    container: { backgroundColor: colors.light.destructive },
    text: { color: colors.light.destructiveForeground },
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.light.border,
    },
    text: { color: colors.light.foreground },
  },
};

export function Badge({ variant = "default", children, style }: BadgeProps) {
  const v = variantStyles[variant];

  return (
    <View style={[styles.badge, v.container, style]}>
      <AppText style={[styles.text, v.text]}>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
});
