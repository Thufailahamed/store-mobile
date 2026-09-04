import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { SellerPayoutCompliance } from "@/lib/seller-access";

type KycStatus = "not_started" | "pending" | "approved" | "rejected";

interface Props {
  payout: SellerPayoutCompliance | null;
}

function deriveStatus(payout: SellerPayoutCompliance | null): KycStatus {
  if (!payout) return "not_started";
  const bankOk = !!payout.bank_name && !!payout.account_name && !!payout.account_number_last4;
  if (payout.tax_form_submitted && bankOk) return "approved";
  if (bankOk) return "pending";
  return "not_started";
}

export function KycStatusCard({ payout }: Props) {
  const router = useRouter();
  const status = deriveStatus(payout);
  const pill: Record<KycStatus, { bg: string; text: string; label: string }> = {
    not_started: { bg: "#f3f4f6", text: "#6b7280", label: "Not started" },
    pending: { bg: "#fef3c7", text: "#92400e", label: "Pending review" },
    approved: { bg: "#dcfce7", text: "#166534", label: "Approved" },
    rejected: { bg: "#fee2e2", text: "#991b1b", label: "Rejected" },
  };
  const p = pill[status];
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push("/(seller)/payouts/settings" as any)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>KYC status</Text>
        <View style={[styles.pill, { backgroundColor: p.bg }]}>
          <Text style={[styles.pillText, { color: p.text }]}>{p.label}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Manage payouts</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[4],
    gap: spacing[3],
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  pillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
});
