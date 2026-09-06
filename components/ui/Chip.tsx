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
  compact?: boolean;
}

const toneStyles: Record<ChipTone, { bg: string; text: string; border: string }> = {
  default: { bg: colors.paper.cream, text: colors.ink.mute, border: "rgba(83,94,44,0.12)" },
  primary: { bg: colors.olive[800], text: colors.paper.cream, border: colors.olive[800] },
  olive: { bg: colors.olive[50], text: colors.olive[800], border: "rgba(83,94,44,0.14)" },
  amber: { bg: "#f8f1e3", text: "#8a6a2a", border: "rgba(200,164,74,0.35)" },
  rust: { bg: "rgba(184,92,58,0.1)", text: colors.accent2.rust, border: "rgba(184,92,58,0.22)" },
  ink: { bg: colors.olive[950], text: colors.paper.cream, border: colors.olive[950] },
};

export function Chip({ children, tone = "default", onPress, selected, style, compact }: ChipProps) {
  const t = toneStyles[selected ? "primary" : tone];
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: t.bg, borderColor: t.border },
        selected && styles.chipSelected,
        style,
      ]}
    >
      <Text style={[styles.text, compact && styles.textCompact, { color: t.text }]}>{children}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  chipSelected: {
    shadowColor: colors.olive[900],
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
