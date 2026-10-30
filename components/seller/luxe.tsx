import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;

/** Text + surface colours for content placed on a LuxeHero. */
export const HERO = {
  ink: colors.olive[950],
  text: colors.olive[800],
  mute: colors.ink.mute,
  kicker: colors.olive[700],
  tile: "rgba(83,94,44,0.06)",
  tileBorder: "rgba(83,94,44,0.14)",
  chip: "#fffdf8",
  chipBorder: "rgba(83,94,44,0.22)",
  divider: "rgba(83,94,44,0.14)",
} as const;

/**
 * Light "paper" hero — cream gradient with a faint olive wash and a hairline
 * sheen, the same surface as the seller home revenue card. Compact by default.
 */
export function LuxeHero({
  children,
  style,
  radius = 24,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  return (
    <View style={[styles.hero, { borderRadius: radius }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={["#f5f4ef", "#faf8f1", "#efece2"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(83,94,44,0.10)", "transparent", "rgba(83,94,44,0.05)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View pointerEvents="none" style={styles.sheen} />
      {children}
    </View>
  );
}

/** Pressable that gently scales on touch. */
export function PressScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [style, { transform: [{ scale: pressed ? 0.975 : 1 }], opacity: pressed ? 0.92 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

/** Small mono eyebrow + display title section header with a gold rule. */
export function LuxeSectionHeader({ eyebrow, title, trailing }: { eyebrow: string; title?: string; trailing?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.eyebrowRow}>
          <View style={styles.rule} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 16,
    overflow: "hidden",
    backgroundColor: "#f5f4ef",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.14)",
    shadowColor: "#3d4423",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  sheen: { position: "absolute", top: 0, left: 24, right: 24, height: 1, backgroundColor: "rgba(83,94,44,0.18)" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", marginTop: 28, marginBottom: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  rule: { width: 14, height: 1.5, borderRadius: 1, backgroundColor: GOLD },
  eyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.4, color: colors.olive[600] },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: colors.olive[950], letterSpacing: -0.2 },
});
