import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPayoutsBackend, updatePayoutSettingsBackend } from "@/lib/api/backend";
import { MethodPicker } from "@/components/payouts/MethodPicker";
import { StripeConnectCard } from "@/components/payouts/StripeConnectCard";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { PayoutSettings } from "@/lib/api/backend";

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });
  const initial: PayoutSettings = data?.ok ? (data.data.payout ?? {}) : {};
  const [draft, setDraft] = useState<PayoutSettings>(initial);
  const [hydrated, setHydrated] = useState(false);

  React.useEffect(() => {
    if (!hydrated && data?.ok) {
      setDraft(data.data.payout ?? {});
      setHydrated(true);
    }
  }, [data, hydrated]);

  const mutation = useMutation({
    mutationFn: () => updatePayoutSettingsBackend(draft),
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["payouts"] });
        Alert.alert("Saved", "Payout settings updated.");
      } else Alert.alert("Save failed", res.error ?? "Try again.");
    },
  });

  if (isLoading || !hydrated) {
    return <View style={styles.center}><Text style={styles.body}>Loading…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Payout settings</Text>
        <StripeConnectCard hasAccount={Boolean(initial.stripe_account_id)} accountId={initial.stripe_account_id ?? null} />
        <MethodPicker value={draft} onChange={setDraft} />
        <Button onPress={() => mutation.mutate()} disabled={mutation.isPending} accessibilityLabel="Save payout settings">
          {mutation.isPending ? "Saving…" : "Save settings"}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], gap: spacing[4] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
});
