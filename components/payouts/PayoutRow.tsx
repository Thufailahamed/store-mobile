import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/utils";
import { colors, spacing } from "@/lib/theme/tokens";
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
  /** Position within the history list, so rows render as one grouped card. */
  first?: boolean;
  last?: boolean;
}

export function PayoutRow({ payout, onPress, first = true, last = true }: Props) {
  const tone = STATUS_TONE[payout.status] ?? STATUS_TONE.pending;
  const label = formatPayoutStatus(payout.status);
  return (
    <Pressable
      accessibilityLabel={`Payout ${label} ${formatPrice(payout.amount, payout.currency)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, first ? styles.rowFirst : styles.rowDivider, last && styles.rowLast, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={18} color={tone.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.amount} numberOfLines={1}>{formatPrice(payout.amount, payout.currency)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {(payout.method ?? "bank").replace(/_/g, " ")} · {formatDate(payout)}
        </Text>
      </View>
      <Text style={[styles.status, { color: tone.text }]}>{label}</Text>
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
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.12)" },
  rowPressed: { backgroundColor: colors.olive[50] },
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
  status: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
});
