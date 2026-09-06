import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStripeConnectLinkBackend, getPayoutsBackend } from "@/lib/api/backend";
import { isPayoutKycError, payoutKycUserMessage } from "@/lib/payouts/settings";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

interface Props {
  hasAccount: boolean;
  accountId?: string | null;
}

export function StripeConnectCard({ hasAccount, accountId }: Props) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const returnUrl = Linking.createURL("/payouts/connect-return", {
        queryParams: { success: "true" },
      });
      const refreshUrl = Linking.createURL("/payouts/connect-return", {
        queryParams: { refresh: "true" },
      });
      return createStripeConnectLinkBackend({ return_url: returnUrl, refresh_url: refreshUrl });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        const message = res.error ?? "Could not create Stripe onboarding link.";
        if (isPayoutKycError(message)) {
          Alert.alert("Verify your identity first", payoutKycUserMessage(message));
          return;
        }
        Alert.alert("Connect failed", message);
        return;
      }
      await WebBrowser.openAuthSessionAsync(
        res.data.url,
        Linking.createURL("/payouts/connect-return"),
      );

      // Backend honors the deep-link return_url we sent. Still refetch in case
      // the auth session closes without a redirect callback.
      const [settings] = await Promise.all([
        getPayoutsBackend(),
        qc.invalidateQueries({ queryKey: ["payouts"] }),
        qc.invalidateQueries({ queryKey: ["payout-settings"] }),
      ]);

      if (!settings.ok) {
        Alert.alert(
          "Couldn’t confirm Stripe status",
          "We couldn’t reach the server to check your account. Pull to refresh in a moment.",
        );
        return;
      }
      if (settings.data.payout?.stripe_account_id) {
        Alert.alert("Stripe Connect linked", "Your payouts will now disburse automatically.");
      } else {
        Alert.alert(
          "Onboarding not finished",
          "Stripe didn’t confirm your account yet. You can reopen onboarding to complete the remaining steps.",
        );
      }
    },
    onError: (e: unknown) => {
      Alert.alert("Stripe Connect", e instanceof Error ? e.message : "Couldn’t start Stripe onboarding.");
    },
  });

  return (
    <View style={styles.card}>
      {hasAccount ? (
        <>
          <Text style={styles.linkedTitle}>Stripe Connect linked</Text>
          <Text style={styles.status}>
            {accountId
              ? `Funds disburse to ${accountId.slice(0, 8)}…`
              : "Funds disburse automatically into your connected Stripe account."}
          </Text>
          <Pressable
            accessibilityLabel="Reopen Stripe onboarding"
            accessibilityRole="button"
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={styles.secondaryCta}
          >
            <Text style={styles.secondaryCtaText}>
              {mutation.isPending ? "Opening Stripe…" : "Update Stripe details"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.status}>
            Connect your Stripe Express account to automate payouts.
          </Text>
          <Pressable
            accessibilityLabel="Onboard with Stripe Connect"
            accessibilityRole="button"
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>
              {mutation.isPending ? "Opening Stripe…" : "Onboard with Stripe Connect"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[3],
    backgroundColor: "rgba(83,94,44,0.04)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    gap: spacing[2],
  },
  linkedTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  status: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  cta: {
    minHeight: 44,
    paddingVertical: 12,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  ctaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  secondaryCta: {
    minHeight: 44,
    paddingVertical: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  secondaryCtaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[900],
  },
});
