import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStripeConnectLinkBackend } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  hasAccount: boolean;
  accountId?: string | null;
}

export function StripeConnectCard({ hasAccount, accountId }: Props) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => createStripeConnectLinkBackend(),
    onSuccess: async (res) => {
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["payouts"] });
        Linking.openURL(res.data.url);
      }
    },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stripe Connect</Text>
      <Text style={styles.status}>{hasAccount ? `Onboarded${accountId ? ` • ${accountId.slice(0, 8)}…` : ""}` : "Not connected"}</Text>
      <Pressable
        accessibilityLabel={hasAccount ? "Update Stripe Connect" : "Connect with Stripe"}
        accessibilityRole="button"
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>
          {mutation.isPending ? "Opening Stripe…" : hasAccount ? "Update details" : "Connect with Stripe"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing[4], marginHorizontal: spacing[4], marginVertical: spacing[2], backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, gap: spacing[2] },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  status: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  cta: { paddingVertical: spacing[3], backgroundColor: colors.light.primary, borderRadius: radii.md, alignItems: "center", marginTop: spacing[2] },
  ctaText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: "#FFFFFF" },
});
