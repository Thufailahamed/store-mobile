import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { WithdrawSheet } from "@/components/brand/WithdrawSheet";
import { PayoutSettingsForm } from "@/components/brand/PayoutSettingsForm";
import { getBrandPayouts, getBrandPayoutsBalance } from "@/lib/api";
import { getBrandPayoutSettingsBackend } from "@/lib/api/backend";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export default function BrandPayouts() {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const balanceQ = useQuery({
    queryKey: ["brand-payouts-balance"],
    queryFn: async () => {
      const r = await getBrandPayoutsBalance();
      return r.ok ? r.data : null;
    },
  });
  const listQ = useQuery({
    queryKey: ["brand-payouts"],
    queryFn: async () => {
      const r = await getBrandPayouts();
      return r.ok ? r.data : [];
    },
  });
  const settingsQ = useQuery({
    queryKey: ["brand-payout-settings"],
    queryFn: async () => {
      const r = await getBrandPayoutSettingsBackend();
      return r.ok ? r.data.payout : null;
    },
  });

  const available = Math.max(
    0,
    (balanceQ.data?.lifetime_net ?? 0) - (balanceQ.data?.pending ?? 0),
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Payouts"
        subtitle="Lifetime earnings, bank details, and withdrawals"
        back={{ onPress: () => router.back() }}
      />
      {balanceQ.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : balanceQ.data ? (
        <>
          <View style={styles.grid}>
            <BrandStatCard label="Available" value={formatPrice(available, "LKR")} tone="accent" />
            <BrandStatCard label="Lifetime gross" value={formatPrice(balanceQ.data.lifetime_gross, "LKR")} />
            <BrandStatCard label="Commission" value={formatPrice(balanceQ.data.lifetime_commission, "LKR")} tone="warn" />
            <BrandStatCard label="Pending" value={formatPrice(balanceQ.data.pending, "LKR")} />
          </View>
          <Card style={styles.noteCard}>
            <Text style={styles.noteTitle}>Commission rate</Text>
            <Text style={styles.noteBody}>{Math.round((balanceQ.data.commission_rate ?? 0) * 100)}% per sale</Text>
            <Text style={styles.noteFoot}>Computed at read time from order_items × products.brand_id.</Text>
          </Card>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Withdraw"
              onPress={() => setShowWithdraw((v) => !v)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionText}>{showWithdraw ? "Hide withdraw" : "Withdraw"}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Payout settings"
              onPress={() => setShowSettings((v) => !v)}
              style={styles.actionBtnSecondary}
            >
              <Text style={styles.actionTextSecondary}>{showSettings ? "Hide settings" : "Settings"}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {showWithdraw ? (
        <View style={styles.sheetWrap}>
          <WithdrawSheet
            available={available}
            settings={settingsQ.data ?? null}
            kycApproved
            onSuccess={() => {
              void balanceQ.refetch();
              void listQ.refetch();
              setShowWithdraw(false);
            }}
          />
        </View>
      ) : null}

      {showSettings ? (
        <View style={styles.sheetWrap}>
          {settingsQ.isLoading ? (
            <ActivityIndicator />
          ) : (
            <PayoutSettingsForm
              initial={settingsQ.data ?? null}
              onSaved={() => {
                void settingsQ.refetch();
              }}
            />
          )}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Recent payouts</Text>
      {listQ.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : !listQ.data || listQ.data.length === 0 ? (
        <EmptyState icon="wallet-outline" title="No payouts yet" />
      ) : (
        listQ.data.map((p) => (
          <Card key={p.id} style={styles.payoutCard}>
            <View style={styles.payoutRow}>
              <Text style={styles.payoutAmount}>{formatPrice(p.amount, p.currency)}</Text>
              <Text style={styles.payoutStatus}>{p.status}</Text>
            </View>
            <Text style={styles.payoutMeta}>{new Date(p.created_at).toLocaleDateString()}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 100, margin: 20, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  noteCard: { margin: 20, padding: 16, gap: 4 },
  noteTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  noteBody: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.lg, color: colors.light.primary },
  noteFoot: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  actionBtn: { flex: 1, backgroundColor: colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  actionText: { color: "#fff", fontFamily: fontFamilies.sans.semibold },
  actionBtnSecondary: { flex: 1, borderWidth: 1, borderColor: colors.light.border, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.light.card },
  actionTextSecondary: { color: colors.light.foreground, fontFamily: fontFamilies.sans.semibold },
  sheetWrap: { marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  payoutCard: { marginHorizontal: 20, marginBottom: 8, padding: 12, gap: 4 },
  payoutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payoutAmount: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  payoutStatus: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.primary, textTransform: "uppercase" },
  payoutMeta: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
