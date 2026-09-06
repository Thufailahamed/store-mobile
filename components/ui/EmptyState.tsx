import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
  /** Soft editorial panel vs plain centered empty. */
  framed?: boolean;
}

export function EmptyState({
  icon = "leaf-outline",
  title,
  description,
  action,
  style,
  framed = true,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrap, framed && styles.framed, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.olive[700]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
    gap: 8,
  },
  framed: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  desc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 21,
    color: colors.ink.mute,
    textAlign: "center",
    maxWidth: 290,
  },
  action: { marginTop: 14, alignItems: "center" },
});
