import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { PayoutBalance } from "@/lib/api/backend";

interface Props {
  balance: PayoutBalance;
  onWithdraw: () => void;
}

export function BalanceCard({ balance, onWithdraw }: Props) {
  return (
    <LinearGradient colors={[colors.light.primary, colors.light.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.label}>Available balance</Text>
      <Text style={styles.balance}>{formatPrice(balance.available, balance.currency)}</Text>
      <View style={styles.row}>
        <Stat label="Pending" value={formatPrice(balance.pending, balance.currency)} />
        <Stat label="Lifetime paid" value={formatPrice(balance.lifetime, balance.currency)} />
      </View>
      <Pressable accessibilityLabel="Withdraw funds" accessibilityRole="button" onPress={onWithdraw} style={styles.cta}>
        <Text style={styles.ctaText}>Withdraw</Text>
      </Pressable>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, padding: spacing[5], marginHorizontal: spacing[4], marginVertical: spacing[3], gap: spacing[3] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: "#FFFFFF", opacity: 0.9 },
  balance: { fontFamily: fontFamilies.sans.semibold, fontSize: 32, color: "#FFFFFF" },
  row: { flexDirection: "row", gap: spacing[4], marginTop: spacing[2] },
  stat: { flex: 1, gap: 2 },
  statLabel: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: "#FFFFFF", opacity: 0.85 },
  statValue: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: "#FFFFFF" },
  cta: { marginTop: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[5], backgroundColor: "#FFFFFF", borderRadius: radii.full, alignSelf: "flex-start" },
  ctaText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primary },
});
