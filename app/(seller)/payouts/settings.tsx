import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getPayoutsBackend,
  getSellerPayoutSettingsBackend,
  updatePayoutSettingsBackend,
} from "@/lib/api/backend";
import {
  MethodPicker,
  describePayout,
} from "@/components/payouts/MethodPicker";
import { useToast } from "@/components/ui";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerStateView } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  mergePayoutSettings,
  toPayoutPayload,
  validatePayoutDraft,
  withPayoutDefaults,
} from "@/lib/payouts/settings";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];
const GOLD = colors.accent2.ochre;

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
  const { toast } = useToast();
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
      if (
        data.stripe_account_id &&
        data.stripe_account_id !== prev.stripe_account_id
      ) {
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
      return withPayoutDefaults(
        mergePayoutSettings(patchRes.data.payout, next),
      );
    },
    onSuccess: async (saved) => {
      setDraft(saved);
      await qc.invalidateQueries({ queryKey: ["payouts"] });
      await qc.invalidateQueries({ queryKey: ["payout-settings"] });
      toast.success("Payout details saved");
    },
    onError: (e: unknown) => {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Try again.");
    },
  });

  const header = (
    <>
      <View
        style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}
      >
        <SellerBackButton
          label="Payouts"
          fallbackHref="/(seller)/payouts"
          style={{ marginBottom: 14 }}
        />
        <Text style={styles.kicker}>Atelier · Ledger</Text>
        <Text style={styles.title}>Payout settings</Text>
        <Text style={styles.subtitle}>Where your earnings are sent</Text>
      </View>
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

  const dirty = JSON.stringify(draft) !== JSON.stringify(data);
  const summary = describePayout(draft);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {header}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryKicker}>
            {dirty ? "After you save" : "Currently paying out to"}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name={summary.icon} size={18} color={GOLD} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {summary.title}
              </Text>
              <Text style={styles.summaryDetail} numberOfLines={2}>
                {summary.detail}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sections}>
          <MethodPicker value={draft} onChange={setDraft} />
        </View>
      </ScrollView>

      {dirty || mutation.isPending ? (
        <View style={styles.footer}>
          <Text style={styles.saveHint}>
            Unsaved changes · applies to future settlements
          </Text>
          <View style={styles.footerActions}>
            {!mutation.isPending ? (
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => data && setDraft(data)}
                disabled={mutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Discard changes"
              >
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!dirty || mutation.isPending) && styles.saveBtnDisabled,
              ]}
              onPress={() => mutation.mutate(draft)}
              disabled={!dirty || mutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save payout settings"
            >
              <Ionicons
                name={mutation.isPending ? "hourglass-outline" : "checkmark"}
                size={16}
                color={CREAM}
              />
              <Text style={styles.saveText}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingBottom: 32 },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
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
  summaryCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    borderRadius: 22,
    backgroundColor: colors.olive[900],
    padding: 16,
  },
  summaryKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.6)",
    marginBottom: 10,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: CREAM,
  },
  summaryDetail: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.7)",
  },
  sections: { marginHorizontal: spacing[5] },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.paper.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.16)",
    gap: 8,
  },
  footerActions: { flexDirection: "row", gap: 10 },
  discardBtn: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.2)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[900],
  },
  saveBtn: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  saveHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
    textAlign: "center",
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
