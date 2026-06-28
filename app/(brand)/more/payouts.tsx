import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandPayouts, getBrandPayoutsBalance } from "@/lib/api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export default function BrandPayouts() {
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Payouts"
        subtitle="Lifetime earnings and recent payouts"
        back={{ onPress: () => router.back() }}
      />
      {balanceQ.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : balanceQ.data ? (
        <>
          <View style={styles.grid}>
            <BrandStatCard label="Lifetime gross" value={formatPrice(balanceQ.data.lifetime_gross, "LKR")} tone="accent" />
            <BrandStatCard label="Commission" value={formatPrice(balanceQ.data.lifetime_commission, "LKR")} tone="warn" />
            <BrandStatCard label="Lifetime net" value={formatPrice(balanceQ.data.lifetime_net, "LKR")} />
            <BrandStatCard label="Pending" value={formatPrice(balanceQ.data.pending, "LKR")} />
          </View>
          <Card style={styles.noteCard}>
            <Text style={styles.noteTitle}>Commission rate</Text>
            <Text style={styles.noteBody}>{Math.round((balanceQ.data.commission_rate ?? 0) * 100)}% per sale</Text>
            <Text style={styles.noteFoot}>Computed at read time from order_items × products.brand_id.</Text>
          </Card>
        </>
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
