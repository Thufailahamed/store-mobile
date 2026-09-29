import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { PayoutRow } from "@/components/payouts/PayoutRow";
import { getPayoutBalanceBackend, getPayoutsBackend } from "@/lib/api/backend";
import { formatPrice, pluralize } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import { payoutUserMessage } from "@/lib/payouts/ledger";
import { coercePayoutSettings } from "@/lib/payouts/settings";
import type { PayoutBalance, PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const INK = colors.olive[950];

const MIN_WITHDRAWAL = 100;

const METHOD_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  bank: { label: "Bank transfer", icon: "card-outline" },
  upi: { label: "UPI", icon: "flash-outline" },
  paypal: { label: "PayPal", icon: "logo-paypal" },
  stripe_connect: { label: "Stripe Connect", icon: "link-outline" },
};

const SCHEDULE_LABEL: Record<string, string> = {
  daily: "Daily payouts",
  weekly: "Weekly payouts",
  biweekly: "Every two weeks",
  monthly: "Monthly payouts",
};

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

function destinationTitle(settings: PayoutSettings): string {
  if (settings.bank_name) return settings.bank_name;
  return METHOD_META[settings.method ?? ""]?.label ?? "Payout account";
}

function destinationSubtitle(settings: PayoutSettings): string {
  const parts: string[] = [];
  if (settings.account_number_last4) parts.push(`···· ${settings.account_number_last4}`);
  else if (settings.upi) parts.push(settings.upi);
  else if (settings.paypal) parts.push(settings.paypal);
  else if (settings.method) parts.push(METHOD_META[settings.method]?.label ?? settings.method);
  if (settings.schedule) parts.push(SCHEDULE_LABEL[settings.schedule] ?? settings.schedule);
  return parts.join(" · ") || "Payout destination";
}

export default function PayoutsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const list = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });
  const { refetch: refetchBalance } = balance;
  const { refetch: refetchList } = list;

  useFocusEffect(
    React.useCallback(() => {
      void refetchBalance();
      void refetchList();
    }, [refetchBalance, refetchList]),
  );

  const onRefresh = () => {
    void refetchBalance();
    void refetchList();
  };

  const bal: PayoutBalance | null = balance.data?.ok ? balance.data.data : null;
  const payouts = list.data?.ok ? list.data.data.payouts : [];
  // Coerce so placeholder rows ("Grandfathered Bank", "0000") read as not-set, matching the settings screen.
  const settings = list.data?.ok && list.data.data.payout ? coercePayoutSettings(list.data.data.payout) : null;
  const balanceError = balance.data && !balance.data.ok ? balance.data.error : null;
  const listError = list.data && !list.data.ok ? list.data.error : null;
  const available = bal ? money(bal.available, bal.currency) : "—";
  const canWithdraw = Boolean(bal && Number.isFinite(bal.available) && bal.available >= MIN_WITHDRAWAL);
  const failedCount = payouts.filter((p) => p.status === "failed").length;

  const headerSubtitle = list.isLoading && payouts.length === 0
    ? "Loading settlements…"
    : listError
      ? "Payout history unavailable"
      : payouts.length === 0
        ? "Earnings and withdrawals"
        : `${payouts.length} ${pluralize(payouts.length, "settlement")}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Atelier</Text>
          <Text style={styles.title}>Payouts</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/(seller)/payouts/settings")}
          accessibilityRole="button"
          accessibilityLabel="Payout settings"
        >
          <Ionicons name="settings-outline" size={17} color={colors.olive[800]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={payouts}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={balance.isRefetching || list.isRefetching} onRefresh={onRefresh} tintColor={colors.olive[800]} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {balance.isLoading && !bal ? (
              <View style={styles.balanceCard}>
                <Skeleton width="40%" height={12} />
                <Skeleton width="55%" height={30} />
                <Skeleton width="80%" height={12} />
              </View>
            ) : (
              <View style={styles.balanceCard}>
                <View style={styles.balanceTop}>
                  <Text style={styles.balanceKicker}>Available to withdraw</Text>
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="wallet-outline" size={15} color={GOLD} />
                  </View>
                </View>
                <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{available}</Text>

                <View style={styles.balanceRow}>
                  <View style={styles.statTile}>
                    <View style={styles.statHead}>
                      <Ionicons name="time-outline" size={12} color="rgba(250,248,241,0.55)" />
                      <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {bal ? money(bal.pending, bal.currency) : "—"}
                    </Text>
                  </View>
                  <View style={styles.statTile}>
                    <View style={styles.statHead}>
                      <Ionicons name="checkmark-circle-outline" size={12} color="rgba(250,248,241,0.55)" />
                      <Text style={styles.statLabel}>Lifetime paid</Text>
                    </View>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {bal ? money(bal.lifetime, bal.currency) : "—"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
                  onPress={() => router.push("/(seller)/payouts/withdraw")}
                  accessibilityRole="button"
                  accessibilityLabel="Withdraw funds"
                  disabled={!canWithdraw}
                  activeOpacity={0.85}
                >
                  <Text style={styles.withdrawBtnText}>
                    {canWithdraw ? "Withdraw funds" : `Minimum ${money(MIN_WITHDRAWAL, bal?.currency)}`}
                  </Text>
                  <View style={styles.withdrawArrow}>
                    <Ionicons name="arrow-forward" size={14} color={GOLD} />
                  </View>
                </TouchableOpacity>
                {canWithdraw ? (
                  <Text style={styles.balanceFoot}>
                    Minimum withdrawal {money(MIN_WITHDRAWAL, bal?.currency)}
                  </Text>
                ) : null}
                {balanceError ? (
                  <Text style={styles.balanceError}>
                    {payoutUserMessage(balanceError, "Couldn’t load balance. Pull to retry.")}
                  </Text>
                ) : null}
              </View>
            )}

            <Text style={styles.groupLabel}>Paid out to</Text>
            <TouchableOpacity
              style={styles.destinationCard}
              onPress={() => router.push("/(seller)/payouts/settings")}
              accessibilityRole="button"
              accessibilityLabel="Payout destination settings"
              activeOpacity={0.85}
            >
              <View style={styles.destinationIcon}>
                <Ionicons
                  name={METHOD_META[settings?.method ?? ""]?.icon ?? "card-outline"}
                  size={17}
                  color={colors.olive[800]}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.destinationTitle} numberOfLines={1}>
                  {settings ? destinationTitle(settings) : "Not set up"}
                </Text>
                <Text style={styles.destinationSub} numberOfLines={1}>
                  {settings ? destinationSubtitle(settings) : "Add a bank account to withdraw earnings"}
                </Text>
              </View>
              <Text style={styles.destinationAction}>{settings ? "Change" : "Set up"}</Text>
            </TouchableOpacity>

            {failedCount > 0 ? (
              <View style={styles.failedStrip}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.accent2.rust} />
                <Text style={styles.failedText}>
                  {failedCount} {pluralize(failedCount, "payout")} failed — tap to review details
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.groupLabel}>History</Text>
              {payouts.length > 0 ? (
                <Text style={styles.sectionCount}>{payouts.length}</Text>
              ) : null}
            </View>
            {listError ? (
              <Text style={styles.emptySub}>{payoutUserMessage(listError, "Couldn’t load payout history.")}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <PayoutRow
            payout={item}
            first={index === 0}
            last={index === payouts.length - 1}
            onPress={() => router.push(`/(seller)/payouts/${item.id}` as const)}
          />
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={68} borderRadius={16} />
              <Skeleton height={68} borderRadius={16} />
            </View>
          ) : listError ? null : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No payouts yet</Text>
              <Text style={styles.emptyLead}>Here’s how money reaches your bank:</Text>
              {[
                { icon: "time-outline" as const, title: "Pending", body: "New earnings wait here until they clear." },
                { icon: "wallet-outline" as const, title: "Available", body: "Cleared funds are ready to withdraw." },
                { icon: "business-outline" as const, title: "Paid out", body: "Withdrawals settle to your payout account and show up below." },
              ].map((step, i, arr) => (
                <View key={step.title} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={styles.stepIcon}>
                      <Ionicons name={step.icon} size={14} color={colors.olive[800]} />
                    </View>
                    {i < arr.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepText}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    gap: 12,
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
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: 48 },

  balanceCard: {
    backgroundColor: colors.olive[900],
    borderRadius: 26,
    padding: 20,
    marginBottom: 22,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  balanceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.65)",
  },
  balanceValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 38,
    lineHeight: 46,
    color: CREAM,
    letterSpacing: -0.8,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  balanceRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "rgba(250,248,241,0.07)",
  },
  statHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "rgba(250,248,241,0.6)" },
  statValue: {
    marginTop: 4,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: CREAM,
    fontVariant: ["tabular-nums"],
  },
  withdrawBtn: {
    marginTop: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 6,
    backgroundColor: GOLD,
    borderRadius: radii.full,
  },
  withdrawBtnDisabled: { opacity: 0.45 },
  withdrawBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.olive[950] },
  withdrawArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[950],
    alignItems: "center",
    justifyContent: "center",
  },
  balanceFoot: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250,248,241,0.5)",
  },
  balanceError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.8)",
    marginTop: 10,
  },

  groupLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
    marginBottom: 22,
  },
  destinationIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  destinationTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: INK,
  },
  destinationSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    marginTop: 2,
  },
  destinationAction: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.olive[800],
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },

  failedStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(184,92,58,0.1)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.25)",
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  failedText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.accent2.rust,
  },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
  },
  emptyTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: INK },
  emptyLead: { marginTop: 3, marginBottom: 16, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.ink.mute },
  step: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center", width: 30 },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, width: 1, minHeight: 14, backgroundColor: "rgba(83,94,44,0.18)", marginVertical: 3 },
  stepBody: { flex: 1, paddingBottom: 14, paddingTop: 5 },
  stepTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: INK },
  stepText: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 17, color: colors.ink.mute },
});
