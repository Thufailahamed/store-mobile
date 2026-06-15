import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface SectionHeaderProps {
  label?: string; // mono small caps
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export function SectionHeader({ label, title, description, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10}>
            <Text style={styles.action}>{action.label} →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  left: { flex: 1 },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
    marginTop: 4,
  },
  desc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  action: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
  },
});
