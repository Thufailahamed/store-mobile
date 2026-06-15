import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const ITEMS = [
  { icon: "car-outline" as const, label: "Free shipping", sub: "On orders $75+" },
  { icon: "refresh-outline" as const, label: "Easy returns", sub: "30-day window" },
  { icon: "shield-checkmark-outline" as const, label: "Secure pay", sub: "Encrypted checkout" },
];

export function TrustStrip() {
  return (
    <View style={styles.wrap}>
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={18} color={colors.light.primary} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.sub}>{item.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    marginBottom: spacing[6],
    padding: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[2],
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.olive[50],
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
