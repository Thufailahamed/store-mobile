import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;

/** Text + surface colours for content placed on a LuxeHero. */
export const HERO = {
  ink: "#16170f",
  text: colors.olive[800],
  mute: colors.light.mutedForeground,
  kicker: colors.olive[600],
  tile: colors.olive[50],
  tileBorder: "rgba(22,23,15,0.07)",
  chip: "#FFFFFF",
  chipBorder: "rgba(22,23,15,0.1)",
  divider: "rgba(22,23,15,0.08)",
} as const;

/**
 * White hero card with a faint warm wash at the top — the same surface as the
 * Orders parcel cards. Compact by default.
 */
export function LuxeHero({
  children,
  style,
  radius = 26,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  return (
    <View style={[styles.hero, { borderRadius: radius }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={["#f6f2e2", "#FFFFFF", "#FFFFFF"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(200,164,74,0.08)", "transparent", "transparent"]}
        locations={[0, 0.5, 1]}
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
    padding: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.07)",
    shadowColor: "#16170f",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sheen: { position: "absolute", top: 0, left: 26, right: 26, height: 1, backgroundColor: "rgba(200,164,74,0.25)" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", marginTop: 28, marginBottom: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  rule: { width: 14, height: 1.5, borderRadius: 1, backgroundColor: GOLD },
  eyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: colors.olive[600] },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: "#16170f", letterSpacing: -0.3 },
});
