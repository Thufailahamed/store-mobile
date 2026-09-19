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
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.olive[700]} />
        </View>
        <View>
          <Label style={styles.headingEyebrow}>SHOP WITH CONFIDENCE</Label>
          <Body size="sm" style={styles.headingTitle}>Protected from checkout to delivery</Body>
        </View>
      </View>
      {/* Trust signals */}
      <View style={styles.trustRow}>
        {TRUST_ITEMS.map((item) => (
          <View key={item.label} style={styles.trustItem}>
            <View style={styles.trustIcon}>
              <Ionicons name={item.icon} size={18} color={colors.olive[700]} />
            </View>
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
    marginHorizontal: spacing[4],
    padding: spacing[4],
    gap: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: `${colors.olive[700]}18`,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  headingIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  headingEyebrow: {
    color: colors.olive[600],
    fontSize: 9,
    marginBottom: 2,
  },
  headingTitle: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
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
    paddingHorizontal: spacing[1],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
    marginBottom: 2,
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
