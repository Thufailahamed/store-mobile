import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface ListRowProps {
  index?: number; // "01", "02"…
  title: string;
  subtitle?: string;
  meta?: string;
  right?: React.ReactNode;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  style?: ViewStyle;
}

export function ListRow({
  index,
  title,
  subtitle,
  meta,
  right,
  leftIcon,
  onPress,
  showDivider = true,
  style,
}: ListRowProps) {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress as any}
      style={[styles.row, style]}
      android_ripple={onPress ? { color: colors.light.muted } : undefined}
    >
      {index !== undefined ? (
        <Text style={styles.index}>{String(index).padStart(2, "0")}</Text>
      ) : null}
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {meta && !right ? <Text style={styles.meta}>{meta}</Text> : null}
      {showDivider ? <View style={styles.divider} /> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  index: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    width: 28,
    textAlign: "right",
  },
  leftIcon: { marginRight: 4 },
  middle: { flex: 1, gap: 2 },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  right: { alignItems: "flex-end", gap: 2 },
  meta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  divider: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
  },
});
