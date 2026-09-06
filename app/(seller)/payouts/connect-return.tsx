import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { getPayoutsBackend } from "@/lib/api/backend";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function ConnectReturn() {
  const params = useLocalSearchParams<{ refresh?: string; success?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  // Without an explicit success/refresh flag we cannot know the outcome, so
  // treat it as "unknown" and offer a way out rather than spinning forever.
  const state = useMemo<"unknown" | "success" | "refresh">(() => {
    if (params.refresh === "true") return "refresh";
    if (params.success === "true") return "success";
    return "unknown";
  }, [params]);

  useEffect(() => {
    const refresh = () => {
      void getPayoutsBackend().then(() => qc.invalidateQueries({ queryKey: ["payouts"] }));
    };
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [qc]);

  useEffect(() => {
    if (state === "success") {
      const t = setTimeout(() => router.replace("/(seller)/payouts/settings"), 0);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.body}>
        {state === "success" ? (
          <>
            <ActivityIndicator accessibilityLabel="Returning to payout settings" />
            <Text style={styles.heading}>Stripe Connect ready</Text>
            <Text style={styles.sub}>Onboarding finished — returning to settings…</Text>
          </>
        ) : state === "refresh" ? (
          <>
            <Text style={styles.heading}>Continue onboarding</Text>
            <Text style={styles.sub}>Stripe needs more information. Tap below to finish setup.</Text>
            <Button onPress={() => router.replace("/(seller)/payouts/settings")} accessibilityLabel="Back to settings">
              Back to settings
            </Button>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Checking your Stripe status</Text>
            <Text style={styles.sub}>
              We’ve refreshed your payout details. Open payout settings to see whether Stripe
              finished verifying your account.
            </Text>
            <Button onPress={() => router.replace("/(seller)/payouts/settings")} accessibilityLabel="Back to settings">
              Back to settings
            </Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  body: { flex: 1, padding: spacing[5], alignItems: "center", justifyContent: "center", gap: spacing[3] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center" },
});
