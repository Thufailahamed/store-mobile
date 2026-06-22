import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface StatRowProps {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "default" | "warning" | "success" | "danger";
  trailing?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

const toneAccent: Record<NonNullable<StatRowProps["tone"]>, string> = {
  default: colors.light.primary,
  warning: "#c8a44a",
  success: colors.olive[500],
  danger: colors.light.destructive,
};

export function StatRow({ label, value, icon, tone = "default", trailing, onPress, style }: StatRowProps) {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress as any}
      style={[styles.row, style]}
      android_ripple={onPress ? { color: colors.light.muted } : undefined}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: toneAccent[tone] + "22" }]}>
          <Ionicons name={icon} size={16} color={toneAccent[tone]} />
        </View>
      ) : null}
      <View style={styles.middle}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 2 },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  trailing: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
});
