import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { AiWallet } from "@/lib/api/backend";

interface Props {
  wallet: AiWallet;
  onTopUp: () => void;
}

export function WalletCard({ wallet, onTopUp }: Props) {
  return (
    <LinearGradient colors={[colors.light.primary, colors.light.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.label}>AI Studio Wallet</Text>
      <Text style={styles.balance}>{formatPrice(wallet.balance, wallet.currency)}</Text>
      <Text style={styles.lifetime}>Lifetime spent: {formatPrice(wallet.lifetimeSpent, wallet.currency)}</Text>
      <Pressable onPress={onTopUp} accessibilityLabel="Top up wallet" accessibilityRole="button" style={styles.cta}>
        <Text style={styles.ctaText}>Top up</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing[5],
    marginHorizontal: spacing[4],
    marginVertical: spacing[3],
    gap: spacing[2],
  },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: "#FFFFFF", opacity: 0.9 },
  balance: { fontFamily: fontFamilies.sans.semibold, fontSize: 32, color: "#FFFFFF" },
  lifetime: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: "#FFFFFF", opacity: 0.85 },
  cta: { marginTop: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[4], backgroundColor: "#FFFFFF", borderRadius: radii.full, alignSelf: "flex-start" },
  ctaText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primary },
});
