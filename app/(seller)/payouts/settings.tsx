import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, TouchableOpacity, StatusBar } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getPayoutsBackend,
  getSellerPayoutSettingsBackend,
  updatePayoutSettingsBackend,
} from "@/lib/api/backend";
import { MethodPicker } from "@/components/payouts/MethodPicker";
import { colors, spacing, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { mergePayoutSettings, toPayoutPayload, validatePayoutDraft, withPayoutDefaults } from "@/lib/payouts/settings";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

async function loadPayoutSettings(): Promise<PayoutSettings> {
  const [listRes, settingsRes] = await Promise.all([
    getPayoutsBackend(),
    getSellerPayoutSettingsBackend(),
  ]);
  if (!listRes.ok && !settingsRes.ok) {
    throw new Error(settingsRes.error || listRes.error);
  }
  return withPayoutDefaults(
    mergePayoutSettings(
      settingsRes.ok ? settingsRes.data.settings : null,
      listRes.ok ? listRes.data.payout : null,
    ),
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payout-settings"],
    queryFn: loadPayoutSettings,
  });
  const [draft, setDraft] = useState<PayoutSettings | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  React.useEffect(() => {
    if (!data) return;
    if (!hydrated) {
      setDraft(data);
      setHydrated(true);
      return;
    }
    setDraft((prev) => {
      if (!prev) return data;
      if (data.stripe_account_id && data.stripe_account_id !== prev.stripe_account_id) {
        return { ...prev, stripe_account_id: data.stripe_account_id };
      }
      return prev;
    });
  }, [data, hydrated]);

  const mutation = useMutation({
    mutationFn: async (next: PayoutSettings) => {
      const message = validatePayoutDraft(next);
      if (message) throw new Error(message);
      const payload = toPayoutPayload(next);
      const patchRes = await updatePayoutSettingsBackend(payload);
      if (!patchRes.ok) throw new Error(patchRes.error || "Save failed");
      return withPayoutDefaults(mergePayoutSettings(patchRes.data.payout, next));
    },
    onSuccess: async (saved) => {
      setDraft(saved);
      await qc.invalidateQueries({ queryKey: ["payouts"] });
      await qc.invalidateQueries({ queryKey: ["payout-settings"] });
      Alert.alert("Saved", "Payout details updated.");
    },
    onError: (e: unknown) => {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Try again.");
    },
  });

  if (isLoading || !hydrated || !draft) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.body}>Loading payout details…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: 32 }]}>
        <Text style={styles.emptyTitle}>Couldn’t load payouts</Text>
        <Text style={styles.body}>{error instanceof Error ? error.message : "Try again."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 40 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={INK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Ledger</Text>
            <Text style={styles.title}>Payouts</Text>
          </View>
        </View>
        <View style={styles.goldRule} />

        <View style={styles.panel}>
          <MethodPicker value={draft} onChange={setDraft} />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
          onPress={() => mutation.mutate(draft)}
          disabled={mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Save payout settings"
        >
          <Text style={styles.saveText}>{mutation.isPending ? "Saving…" : "Save payout settings"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.background, gap: 8 },
  content: { paddingHorizontal: spacing[5], gap: spacing[4] },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingBottom: spacing[2] },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
  },
  panel: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: spacing[4],
  },
  saveBtn: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
