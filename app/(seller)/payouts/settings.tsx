import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Alert, TouchableOpacity, StatusBar } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getPayoutsBackend,
  getSellerPayoutSettingsBackend,
  updatePayoutSettingsBackend,
} from "@/lib/api/backend";
import { MethodPicker } from "@/components/payouts/MethodPicker";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerStateView } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
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

function SettingsSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      <View style={styles.skelCard}>
        <Skeleton width="40%" height={14} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton style={{ flex: 1 }} height={52} borderRadius={14} />
          <Skeleton style={{ flex: 1 }} height={52} borderRadius={14} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton style={{ flex: 1 }} height={52} borderRadius={14} />
          <Skeleton style={{ flex: 1 }} height={52} borderRadius={14} />
        </View>
      </View>
      <View style={styles.skelCard}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="90%" height={44} borderRadius={12} />
        <Skeleton width="90%" height={44} borderRadius={12} />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
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

  const header = (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <SellerBackButton label="Payouts" fallbackHref="/(seller)/payouts" style={{ marginBottom: 6 }} />
        <Text style={styles.kicker}>Atelier · Ledger</Text>
        <Text style={styles.title}>Payout settings</Text>
        <Text style={styles.subtitle}>Where your earnings are sent</Text>
      </View>
      <View style={styles.goldRule} />
    </>
  );

  if (isLoading || !hydrated || !draft) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {header}
        <SettingsSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {header}
        <SellerStateView
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn’t load payout settings"
          description={error instanceof Error ? error.message : "Try again."}
          actionLabel="Try again"
          onAction={() => void refetch()}
          style={{ marginTop: 48 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header}

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
          <Ionicons
            name={mutation.isPending ? "hourglass-outline" : "checkmark-circle-outline"}
            size={16}
            color={CREAM}
          />
          <Text style={styles.saveText}>{mutation.isPending ? "Saving…" : "Save payout settings"}</Text>
        </TouchableOpacity>
        <Text style={styles.saveHint}>Changes apply to future settlements only.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingBottom: 20 },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
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
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    marginTop: 3,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  panel: {
    marginHorizontal: spacing[5],
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: spacing[4],
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  saveBtn: {
    minHeight: 52,
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    flexDirection: "row",
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.olive[950],
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  saveHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: 10,
  },
  skelCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 12,
  },
});
