import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Label, Body } from "@/components/ui/Typography";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TRUST_ITEMS = [
  { icon: "car-outline" as const, label: "Free Shipping", sub: "Islandwide" },
  { icon: "shield-checkmark-outline" as const, label: "Secure Pay", sub: "256-bit SSL" },
  { icon: "refresh-outline" as const, label: "30-Day Returns", sub: "No questions" },
];

const HIGHLIGHT_ITEMS = [
  { icon: "leaf-outline" as const, label: "Sustainable materials" },
  { icon: "ribbon-outline" as const, label: "Premium craftsmanship" },
  { icon: "cube-outline" as const, label: "Ready to ship" },
  { icon: "sparkles" as const, label: "Editor's pick" },
];

export function TrustHighlights() {
  return (
    <View style={styles.container}>
      {/* Trust signals */}
      <View style={styles.trustRow}>
        {TRUST_ITEMS.map((item) => (
          <View key={item.label} style={styles.trustItem}>
            <Ionicons name={item.icon} size={20} color={colors.olive[600]} />
            <Body size="xs" style={styles.trustLabel}>{item.label}</Body>
            <Body size="xs" muted style={styles.trustSub}>{item.sub}</Body>
          </View>
        ))}
      </View>

      {/* Highlights */}
      <View style={styles.highlightsGrid}>
        {HIGHLIGHT_ITEMS.map((item) => (
          <View key={item.label} style={styles.highlightItem}>
            <Ionicons name={item.icon} size={14} color={colors.olive[600]} />
            <Body size="xs" style={styles.highlightLabel}>{item.label}</Body>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  trustRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  trustItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    backgroundColor: `${colors.olive[600]}05`,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}15`,
  },
  trustLabel: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    textAlign: "center",
  },
  trustSub: {
    textAlign: "center",
    fontSize: 9.5,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 1,
  },
  highlightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "47%",
  },
  highlightLabel: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
  },
});
