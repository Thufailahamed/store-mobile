import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const ITEMS = [
  { icon: "car-outline" as const, label: "Islandwide Delivery", sub: "White-glove courier" },
  { icon: "shield-checkmark-outline" as const, label: "Certified Ateliers", sub: "100% Authentic" },
  { icon: "refresh-outline" as const, label: "Effortless Returns", sub: "30-day guarantee" },
];

export function TrustStrip() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.line} />
        <Text style={styles.kicker}>THE LUXE STANDARD</Text>
        <View style={styles.line} />
      </View>
      <View style={styles.wrap}>
        {ITEMS.map((item, i) => (
          <View key={item.label} style={[styles.item, i > 0 && styles.itemDivider]}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={17} color={colors.olive[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.sub}>{item.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[6],
    gap: spacing[2.5],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: `${colors.olive[600]}18`,
  },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: colors.olive[600],
  },
  wrap: {
    paddingHorizontal: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
});
