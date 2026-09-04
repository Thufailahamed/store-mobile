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
        {ITEMS.map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={18} color={colors.olive[600]} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
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
    flexDirection: "row",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
    gap: spacing[2],
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.olive[500]}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.foreground,
    textAlign: "center",
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
});
