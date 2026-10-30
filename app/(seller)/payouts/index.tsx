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
import { SellerGlow } from "@/components/seller/chrome";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { PayoutRow } from "@/components/payouts/PayoutRow";
import { getPayoutBalanceBackend, getPayoutsBackend } from "@/lib/api/backend";
import { formatPrice, pluralize } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import { HERO, LuxeHero, LuxeSectionHeader, PayoutAccountCard, PressScale } from "@/components/payouts/PayoutSurfaces";
import { getMyKyc } from "@/lib/api/kyc";
import { KycBanner } from "@/components/kyc/KycBanner";
import { payoutUserMessage } from "@/lib/payouts/ledger";
import { coercePayoutSettings } from "@/lib/payouts/settings";
import type { PayoutBalance } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const INK = colors.olive[950];

const MIN_WITHDRAWAL = 100;

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function StatTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statHead}>
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={11} color={GOLD} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

export default function PayoutsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const list = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });
  const kyc = useQuery({
    queryKey: ["kyc", "me"],
    queryFn: async () => {
      const r = await getMyKyc();
      return r.ok ? r.data.submissions : [];
    },
  });
  const kycLatest = kyc.data?.[0];
  const kycStatus = kycLatest?.status ?? (kyc.isLoading ? null : "none");
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
  const total = bal ? Math.max(bal.available, 0) + Math.max(bal.pending, 0) : 0;

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
      <SellerGlow />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <SellerBackButton label="More" fallbackHref="/(seller)/more" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} accessibilityRole="header">Payouts</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/(seller)/payouts/settings")}
          accessibilityRole="button"
          accessibilityLabel="Payout settings"
        >
          <Ionicons name="settings-outline" size={19} color={INK} />
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
            {kycStatus && kycStatus !== "approved" ? (
              <KycBanner status={kycStatus} reason={kycLatest?.rejection_reason ?? null} href="/(seller)/payouts/verify" />
            ) : null}
            {balance.isLoading && !bal ? (
              <Skeleton height={230} borderRadius={24} />
            ) : (
              <LuxeHero>
                <View style={styles.balanceTop}>
                  <View style={styles.liveDotWrap}>
                    <View style={styles.liveDot} />
                    <Text style={styles.balanceKicker}>AVAILABLE TO WITHDRAW</Text>
                  </View>
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="wallet-outline" size={15} color={GOLD} />
                  </View>
                </View>
                <Text style={styles.balanceValue} numberOfLines={1}>{available}</Text>

                {bal && total > 0 ? (
                  <View style={styles.splitWrap}>
                    <View style={styles.splitBar}>
                      <View style={[styles.splitAvail, { flex: Math.max(bal.available, 0) }]} />
                      <View style={[styles.splitPending, { flex: Math.max(bal.pending, 0) }]} />
                    </View>
                    <View style={styles.splitLegend}>
                      <Legend color={GOLD} label={`Available ${Math.round((bal.available / total) * 100)}%`} />
                      <Legend color="rgba(83,94,44,0.3)" label={`Clearing ${Math.round((bal.pending / total) * 100)}%`} />
                    </View>
                  </View>
                ) : null}

                <View style={styles.balanceRow}>
                  <StatTile icon="time-outline" label="Pending" value={bal ? money(bal.pending, bal.currency) : "—"} />
                  <StatTile icon="checkmark-done-outline" label="Lifetime paid" value={bal ? money(bal.lifetime, bal.currency) : "—"} />
                </View>

                <PressScale
                  style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
                  onPress={() => router.push("/(seller)/payouts/withdraw")}
                  accessibilityLabel="Withdraw funds"
                  disabled={!canWithdraw}
                >
                  <View>
                    <Text style={styles.withdrawBtnText}>
                      {canWithdraw ? "Withdraw funds" : "Not enough to withdraw"}
                    </Text>
                    <Text style={styles.withdrawBtnSub}>
                      Minimum {money(MIN_WITHDRAWAL, bal?.currency)}
                    </Text>
                  </View>
                  <View style={styles.withdrawArrow}>
                    <Ionicons name="arrow-forward" size={15} color={colors.olive[950]} />
                  </View>
                </PressScale>
                {balanceError ? (
                  <Text style={styles.balanceError}>
                    {payoutUserMessage(balanceError, "Couldn’t load balance. Pull to retry.")}
                  </Text>
                ) : null}
              </LuxeHero>
            )}

            {failedCount > 0 ? (
              <View style={styles.failedStrip}>
                <View style={styles.failedIcon}>
                  <Ionicons name="alert" size={13} color="#FFFFFF" />
                </View>
                <Text style={styles.failedText}>
                  {failedCount} {pluralize(failedCount, "payout")} failed — open it below to see why
                </Text>
              </View>
            ) : null}

            <LuxeSectionHeader eyebrow="DESTINATION" title="Paid out to" />
            <PayoutAccountCard
              settings={settings}
              kicker="SETTLEMENT ACCOUNT"
              onPress={() => router.push("/(seller)/payouts/settings")}
              actionLabel={settings ? "Change" : "Set up"}
            />

            <LuxeSectionHeader
              eyebrow="LEDGER"
              title="History"
              trailing={payouts.length > 0 ? (
                <View style={styles.countPill}><Text style={styles.countText}>{payouts.length}</Text></View>
              ) : null}
            />
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
              <View style={styles.emptyHead}>
                <View style={styles.emptyBadge}>
                  <Ionicons name="sparkles-outline" size={16} color={colors.olive[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyTitle}>No payouts yet</Text>
                  <Text style={styles.emptyLead}>Here’s how money reaches your bank</Text>
                </View>
              </View>
              {[
                { icon: "time-outline" as const, title: "Pending", body: "New earnings wait here until they clear." },
                { icon: "wallet-outline" as const, title: "Available", body: "Cleared funds are ready to withdraw." },
                { icon: "business-outline" as const, title: "Paid out", body: "Withdrawals settle to your payout account and show up here." },
              ].map((step, i, arr) => (
                <View key={step.title} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepIcon, i === 1 && styles.stepIconActive]}>
                      <Ionicons name={step.icon} size={14} color={i === 1 ? colors.paper.cream : colors.olive[800]} />
                    </View>
                    {i < arr.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>
                      <Text style={styles.stepNum}>{String(i + 1).padStart(2, "0")}  </Text>
                      {step.title}
                    </Text>
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
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingBottom: 16,
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
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  settingsBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: 140 },

  balanceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveDotWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  balanceIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: HERO.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.chipBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.5, color: HERO.kicker },
  balanceValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    color: HERO.ink,
    letterSpacing: -0.9,
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  splitWrap: { marginTop: 10, gap: 6 },
  splitBar: { flexDirection: "row", height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(83,94,44,0.08)", gap: 2 },
  splitAvail: { backgroundColor: GOLD, borderRadius: 3 },
  splitPending: { backgroundColor: "rgba(83,94,44,0.3)", borderRadius: 3 },
  splitLegend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: HERO.mute },
  balanceRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  statTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: HERO.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.tileBorder,
  },
  statHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  statIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(200,164,74,0.16)", alignItems: "center", justifyContent: "center" },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: HERO.mute },
  statValue: {
    marginTop: 4,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: HERO.ink,
    fontVariant: ["tabular-nums"],
  },
  withdrawBtn: {
    marginTop: 12,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 5,
    backgroundColor: colors.olive[950],
    borderRadius: radii.full,
  },
  withdrawBtnDisabled: { opacity: 0.4 },
  withdrawBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: CREAM },
  withdrawBtnSub: { marginTop: 1, fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: "rgba(250,248,241,0.6)" },
  withdrawArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#c8e08a",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "#b85c3a",
    marginTop: 8,
  },

  failedStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.25)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 16,
  },
  failedIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent2.rust, alignItems: "center", justifyContent: "center" },
  failedText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.accent2.rust,
  },

  countPill: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  countText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: colors.olive[800] },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  emptyBadge: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.olive[50], borderWidth: 1, borderColor: "rgba(83,94,44,0.14)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, color: INK },
  emptyLead: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: colors.ink.mute },
  step: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center", width: 32 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconActive: { backgroundColor: colors.olive[900], borderColor: colors.olive[900] },
  stepLine: { flex: 1, width: 1.5, minHeight: 14, backgroundColor: "rgba(200,164,74,0.4)", marginVertical: 4 },
  stepBody: { flex: 1, paddingBottom: 16, paddingTop: 6 },
  stepNum: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: GOLD },
  stepTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  stepText: { marginTop: 3, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 18, color: colors.ink.mute },
});
