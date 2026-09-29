import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body } from "@/components/ui/Typography";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TRUST_ITEMS = [
  { icon: "car-outline" as const, label: "Free Shipping", sub: "Islandwide" },
  { icon: "shield-checkmark-outline" as const, label: "Secure Pay", sub: "256-bit SSL" },
  { icon: "refresh-outline" as const, label: "30-Day Returns", sub: "Easy exchanges" },
];

export function TrustHighlights() {
  return (
    <View style={styles.container}>
      {TRUST_ITEMS.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={styles.separator} />}
          <View style={styles.item}>
            <Ionicons name={item.icon} size={20} color={colors.olive[700]} />
            <Body size="xs" style={styles.label}>{item.label}</Body>
            <Body size="xs" muted style={styles.sub}>{item.sub}</Body>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: `${colors.olive[700]}18`,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing[1],
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: `${colors.olive[900]}20`,
    marginVertical: spacing[1],
  },
  label: {
    marginTop: 4,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    textAlign: "center",
  },
  sub: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
  },
});
