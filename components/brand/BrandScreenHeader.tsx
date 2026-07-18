import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface BrandScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  back?: { onPress: () => void; label?: string };
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function BrandScreenHeader({
  eyebrow,
  title,
  subtitle,
  back,
  right,
  style,
}: BrandScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }, style]}>
      {back ? (
        <Pressable onPress={back.onPress} hitSlop={10} style={styles.back}>
          <Text style={styles.backText}>← {back.label ?? "Back"}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.left}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  back: { paddingVertical: 4 },
  backText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  left: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes["2xl"],
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  right: { alignItems: "flex-end", gap: 6 },
});
