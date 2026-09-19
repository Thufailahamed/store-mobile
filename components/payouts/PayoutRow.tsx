import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPayoutStatus } from "@/lib/payouts/ledger";
import type { Payout } from "@/lib/api/backend";

const STATUS_TONE: Record<
  Payout["status"],
  { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a", icon: "time-outline" },
  processing: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800], icon: "sync-outline" },
  paid: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800], icon: "checkmark-circle-outline" },
  failed: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust, icon: "alert-circle-outline" },
  cancelled: { bg: colors.light.muted, text: colors.light.mutedForeground, icon: "close-circle-outline" },
};

function formatDate(payout: Payout): string {
  const raw = payout.status === "paid" && payout.paid_at ? payout.paid_at : payout.created_at;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

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
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={18} color={tone.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.amount}>{formatPrice(payout.amount, payout.currency)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {payout.method ?? "Bank"} · {formatDate(payout)}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.badgeText, { color: tone.text }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
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
    shadowColor: colors.olive[950],
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  rowPressed: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.olive[950],
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    marginTop: 2,
    textTransform: "capitalize",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11 },
});
