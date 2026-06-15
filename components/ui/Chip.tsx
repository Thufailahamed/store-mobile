import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type ChipTone = "default" | "primary" | "olive" | "amber" | "rust" | "ink";

interface ChipProps {
  children: React.ReactNode;
  tone?: ChipTone;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}

const toneStyles: Record<ChipTone, { bg: string; text: string; border: string }> = {
  default: { bg: colors.light.secondary, text: colors.light.foreground, border: "transparent" },
  primary: { bg: colors.light.primary, text: colors.light.primaryForeground, border: "transparent" },
  olive: { bg: colors.olive[100], text: colors.olive[800], border: colors.olive[200] },
  amber: { bg: "#fdf3d7", text: "#7a5b1a", border: "#e8d28a" },
  rust: { bg: "#fbe5dc", text: "#7a2f1a", border: "#e8a78e" },
  ink: { bg: colors.light.foreground, text: colors.light.card, border: "transparent" },
};

export function Chip({ children, tone = "default", onPress, selected, style }: ChipProps) {
  const t = toneStyles[selected ? "primary" : tone];
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: t.text }]}>{children}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
});
