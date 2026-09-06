import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPayoutStatus } from "@/lib/payouts/ledger";
import type { Payout } from "@/lib/api/backend";

const STATUS_TONE: Record<Payout["status"], { bg: string; text: string }> = {
  pending: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a" },
  processing: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800] },
  paid: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  failed: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
  cancelled: { bg: colors.light.muted, text: colors.light.mutedForeground },
};

interface Props {
  payout: Payout;
  onPress: () => void;
}

export function PayoutRow({ payout, onPress }: Props) {
  const tone = STATUS_TONE[payout.status] ?? STATUS_TONE.pending;
  const label = formatPayoutStatus(payout.status);
  return (
    <Pressable
      accessibilityLabel={`Payout ${label} ${formatPrice(payout.amount, payout.currency)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.amount}>{formatPrice(payout.amount, payout.currency)}</Text>
        <Text style={styles.meta}>
          {payout.method ?? "Bank"} · {new Date(payout.created_at).toLocaleDateString("en-LK", { day: "numeric", month: "short" })}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.badgeText, { color: tone.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  amount: { fontFamily: fontFamilies.display.semibold, fontSize: 16, color: colors.olive[950] },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.olive[800], marginTop: 2, textTransform: "capitalize" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11 },
});
