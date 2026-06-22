import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";

const ITEMS = [
  { icon: "car-outline" as const, label: "Islandwide delivery" },
  { icon: "shield-checkmark-outline" as const, label: "Verified ateliers" },
  { icon: "refresh-outline" as const, label: "Easy returns" },
];

export function TrustStrip() {
  return (
    <View style={styles.wrap}>
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <Ionicons name={item.icon} size={18} color={colors.light.primary} />
          <Body size="xs" style={styles.text}>{item.label}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing[2],
    marginVertical: spacing[4],
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: spacing[1],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
  },
  text: {
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
});
