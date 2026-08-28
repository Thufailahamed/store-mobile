import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function ConnectReturn() {
  const params = useLocalSearchParams<{ refresh?: string; success?: string }>();
  const router = useRouter();
  const state = useMemo<"loading" | "success" | "refresh">(() => {
    if (params.refresh === "true") return "refresh";
    if (params.success === "true") return "success";
    return "loading";
  }, [params]);

  useEffect(() => {
    if (state === "success") {
      const t = setTimeout(() => router.replace("/(seller)/payouts/settings"), 0);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.body}>
        {state === "loading" ? (
          <ActivityIndicator accessibilityLabel="Loading Stripe return" />
        ) : state === "success" ? (
          <>
            <Text style={styles.heading}>Stripe Connect ready</Text>
            <Text style={styles.sub}>Onboarding finished — returning to settings…</Text>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Continue onboarding</Text>
            <Text style={styles.sub}>Stripe needs more information. Tap below to finish setup.</Text>
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
