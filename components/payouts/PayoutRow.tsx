import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Payout } from "@/lib/api/backend";

const STATUS_COLORS: Record<Payout["status"], string> = {
  pending: colors.light.mutedForeground,
  processing: colors.light.primary,
  paid: "#16A34A",
  failed: colors.light.destructive,
  cancelled: colors.light.mutedForeground,
};

const STATUS_LABEL: Record<Payout["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

interface Props {
  payout: Payout;
  onPress: () => void;
}

export function PayoutRow({ payout, onPress }: Props) {
  const tone = STATUS_COLORS[payout.status];
  return (
    <Pressable accessibilityLabel={`Payout ${STATUS_LABEL[payout.status]} ${formatPrice(payout.amount, payout.currency)}`} accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.amount}>{formatPrice(payout.amount, payout.currency)}</Text>
        <Text style={styles.meta}>{payout.method ?? "bank"} • {new Date(payout.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone + "22" }]}>
        <Text style={[styles.badgeText, { color: tone }]}>{STATUS_LABEL[payout.status]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginHorizontal: spacing[4], marginVertical: spacing[1], backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border },
  amount: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.full },
  badgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xs },
});
