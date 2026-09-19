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
import { SellerStateView } from "@/components/seller/chrome";
import { payoutUserMessage } from "@/lib/payouts/ledger";
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
  const settings = list.data?.ok ? list.data.data.payout : null;
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
        ? "No settlements yet"
        : pluralize(payouts.length, "settlement");

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
      <View style={styles.goldRule} />

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
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="wallet-outline" size={16} color={GOLD} />
                  </View>
                  <Text style={styles.balanceKicker}>Available to withdraw</Text>
                </View>
                <Text style={styles.balanceValue}>{available}</Text>
                <View style={styles.balanceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statValue}>{bal ? money(bal.pending, bal.currency) : "—"}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statValue}>{bal ? money(bal.lifetime, bal.currency) : "—"}</Text>
                    <Text style={styles.statLabel}>Lifetime paid</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
                  onPress={() => router.push("/(seller)/payouts/withdraw")}
                  accessibilityRole="button"
                  accessibilityLabel="Withdraw funds"
                  disabled={!canWithdraw}
                >
                  <Ionicons name="arrow-up-outline" size={15} color={colors.olive[900]} />
                  <Text style={styles.withdrawBtnText}>
                    {canWithdraw ? "Withdraw funds" : `Minimum ${money(MIN_WITHDRAWAL, bal?.currency)}`}
                  </Text>
                </TouchableOpacity>
                {balanceError ? (
                  <Text style={styles.balanceError}>
                    {payoutUserMessage(balanceError, "Couldn’t load balance. Pull to retry.")}
                  </Text>
                ) : null}
              </View>
            )}

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
              <View style={{ flex: 1 }}>
                <Text style={styles.destinationEyebrow}>Payout destination</Text>
                <Text style={styles.destinationTitle} numberOfLines={1}>
                  {settings ? destinationTitle(settings) : "Not set up"}
                </Text>
                <Text style={styles.destinationSub} numberOfLines={1}>
                  {settings ? destinationSubtitle(settings) : "Add a bank account to withdraw earnings"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.ink.mute} />
            </TouchableOpacity>

            {failedCount > 0 ? (
              <View style={styles.failedStrip}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.accent2.rust} />
                <Text style={styles.failedText}>
                  {pluralize(failedCount, "payout")} failed — tap to review details
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeading}>History</Text>
              {payouts.length > 0 ? (
                <Text style={styles.sectionCount}>{payouts.length}</Text>
              ) : null}
            </View>
            {listError ? (
              <Text style={styles.emptySub}>{payoutUserMessage(listError, "Couldn’t load payout history.")}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PayoutRow payout={item} onPress={() => router.push(`/(seller)/payouts/${item.id}` as const)} />
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={68} borderRadius={16} />
              <Skeleton height={68} borderRadius={16} />
            </View>
          ) : listError ? null : (
            <SellerStateView
              variant="empty"
              icon="wallet-outline"
              title="No payouts yet"
              description="Settlements appear here after a withdrawal is requested."
              style={{ marginTop: 8 }}
            />
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
    paddingBottom: spacing[3],
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
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: 48 },

  balanceCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["2xl"],
    padding: 18,
    marginBottom: 12,
    gap: 8,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  balanceTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 34,
    color: CREAM,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250,248,241,0.6)",
    marginTop: 2,
  },
  statValue: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    color: CREAM,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(250,248,241,0.16)",
    marginRight: 16,
  },
  withdrawBtn: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: GOLD,
    borderRadius: radii.full,
  },
  withdrawBtnDisabled: { opacity: 0.45 },
  withdrawBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.olive[900],
  },
  balanceError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.8)",
    marginTop: 4,
  },

  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  destinationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  destinationEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  destinationTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: INK,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  destinationSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    marginTop: 1,
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

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
  },
  sectionCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
    lineHeight: 20,
  },
});
