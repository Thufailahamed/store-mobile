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
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import { payoutUserMessage } from "@/lib/payouts/ledger";
import type { PayoutBalance } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

export default function PayoutsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const list = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });

  useFocusEffect(
    React.useCallback(() => {
      void balance.refetch();
      void list.refetch();
    }, [balance.refetch, list.refetch]),
  );

  const onRefresh = () => {
    void balance.refetch();
    void list.refetch();
  };

  const bal: PayoutBalance | null = balance.data?.ok ? balance.data.data : null;
  const payouts = list.data?.ok ? list.data.data.payouts : [];
  const balanceError = balance.data && !balance.data.ok ? balance.data.error : null;
  const listError = list.data && !list.data.ok ? list.data.error : null;
  const available = bal ? money(bal.available, bal.currency) : "—";
  const canWithdraw = Boolean(bal && Number.isFinite(bal.available) && bal.available >= 100);

  const headerCount = list.isLoading && payouts.length === 0
    ? "Loading"
    : listError
      ? "Unavailable"
      : payouts.length === 0
        ? "None"
        : `${payouts.length} total`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Atelier</Text>
          <Text style={styles.title}>Payouts</Text>
        </View>
        <Text style={styles.count}>{headerCount}</Text>
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
                <Skeleton width="55%" height={28} />
                <Skeleton width="80%" height={12} />
              </View>
            ) : (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceKicker}>Available to withdraw</Text>
                <Text style={styles.balanceValue}>{available}</Text>
                <View style={styles.balanceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>Pending</Text>
                    <Text style={styles.statValue}>{bal ? money(bal.pending, bal.currency) : "—"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>Lifetime paid</Text>
                    <Text style={styles.statValue}>{bal ? money(bal.lifetime, bal.currency) : "—"}</Text>
                  </View>
                </View>
                {balanceError ? (
                  <Text style={styles.balanceError}>
                    {payoutUserMessage(balanceError, "Couldn’t load balance. Pull to retry.")}
                  </Text>
                ) : null}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, !canWithdraw && styles.primaryBtnDisabled]}
                onPress={() => router.push("/(seller)/payouts/withdraw")}
                accessibilityRole="button"
                accessibilityLabel="Withdraw"
                disabled={!canWithdraw}
              >
                <Ionicons name="arrow-up-outline" size={16} color={CREAM} />
                <Text style={styles.primaryBtnText}>Withdraw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push("/(seller)/payouts/settings")}
                accessibilityRole="button"
                accessibilityLabel="Payment settings"
              >
                <Ionicons name="wallet-outline" size={16} color={INK} />
                <Text style={styles.secondaryBtnText}>Settings</Text>
              </TouchableOpacity>
            </View>
            {!canWithdraw && bal ? (
              <Text style={styles.minHint}>Minimum withdrawal is {money(100, bal.currency)}.</Text>
            ) : null}

            <Text style={styles.sectionHeading}>History</Text>
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
              <Skeleton height={64} borderRadius={16} />
              <Skeleton height={64} borderRadius={16} />
            </View>
          ) : listError ? null : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="wallet-outline" size={28} color={colors.olive[700]} />
              </View>
              <Text style={styles.emptyTitle}>No payouts yet</Text>
              <Text style={styles.emptySub}>
                Settlements appear here after a withdrawal is requested.
              </Text>
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
    paddingBottom: spacing[3],
    gap: 12,
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
  count: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.olive[700],
    paddingBottom: 6,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: 48 },
  balanceCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["2xl"],
    padding: 18,
    marginBottom: 14,
    gap: 8,
  },
  balanceKicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.7)",
  },
  balanceValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    color: CREAM,
    letterSpacing: -0.6,
  },
  balanceRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  statLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250,248,241,0.65)",
  },
  statValue: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 13,
    color: CREAM,
    marginTop: 2,
  },
  balanceError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.8)",
    marginTop: 6,
  },
  actions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: CREAM,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
  },
  minHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.olive[700],
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
    marginTop: 8,
    marginBottom: 10,
  },
  emptyWrap: { alignItems: "center", paddingTop: 24, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: INK,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
    lineHeight: 20,
  },
});
