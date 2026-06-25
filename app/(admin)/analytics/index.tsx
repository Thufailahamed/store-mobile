import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card, StatTile, ProgressBar, Skeleton } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { supabase } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { getAdminAbandonedCartsStats, getAdminPriceAlertsStats } from "@/lib/api";

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
];

export default function AdminAnalytics() {
  const [range, setRange] = useState("30d");
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const statsQ = useQuery({
    queryKey: ["analytics", "stats", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const [ordersRes, signupsRes, revenueRes] = await Promise.all([
        supabase.from("orders").select("id, total, placed_at, status").gte("placed_at", since),
        supabase.from("users").select("id, created_at").gte("created_at", since),
        supabase.from("orders").select("total, placed_at").gte("placed_at", since).eq("payment_status", "paid"),
      ]);
      return {
        orders: ordersRes.data ?? [],
        signups: signupsRes.data ?? [],
        revenue: revenueRes.data ?? [],
      };
    },
  });

  const orders = statsQ.data?.orders ?? [];
  const signups = statsQ.data?.signups ?? [];
  const revenue = statsQ.data?.revenue ?? [];

  const totalRevenue = revenue.reduce((s, r: any) => s + Number(r.total ?? 0), 0);
  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const cancelled = orders.filter((o: any) => o.status === "cancelled").length;
  const cancelRate = orders.length > 0 ? (cancelled / orders.length) * 100 : 0;

  const abandonedQ = useQuery({
    queryKey: ["admin-abandoned-stats"],
    queryFn: async () => {
      const r = await getAdminAbandonedCartsStats();
      return r.ok ? (r.data.stats as any) : null;
    },
  });
  const priceQ = useQuery({
    queryKey: ["admin-price-alerts-stats"],
    queryFn: async () => {
      const r = await getAdminPriceAlertsStats();
      return r.ok ? (r.data.stats as any) : null;
    },
  });

  // simple daily series for the bar chart
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const dayRevenue = revenue.filter((r: any) => r.placed_at?.slice(0, 10) === key).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
    return { key, value: dayRevenue, day: d.getDate() };
  });
  const maxDaily = Math.max(1, ...daily.map((d) => d.value));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ANALYTICS</Text>
        <Text style={styles.title}>Performance</Text>
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <Pressable key={r.key} onPress={() => setRange(r.key)} style={[styles.rangeBtn, range === r.key && styles.rangeBtnActive]}>
            <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      {statsQ.isLoading ? (
        <View style={styles.kpiRow}>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </View>
      ) : (
        <View style={styles.kpiRow}>
          <StatTile label="Revenue" value={formatPrice(totalRevenue)} sub="paid" size="md" />
          <StatTile label="Orders" value={orders.length.toLocaleString()} sub={`${cancelled} cancelled`} size="md" />
          <StatTile label="Signups" value={signups.length.toLocaleString()} sub="new users" size="md" />
          <StatTile label="AOV" value={formatPrice(aov)} sub="avg order" size="md" />
        </View>
      )}

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Revenue · {range.toUpperCase()}</Text>
          <Text style={styles.chartValue}>{formatPrice(totalRevenue)}</Text>
        </View>
        <View style={styles.chart}>
          {daily.map((d, i) => {
            const h = (d.value / maxDaily) * 100;
            return (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.bar, { height: `${Math.max(2, h)}%` }]} />
                {i % Math.ceil(days / 7) === 0 ? <Text style={styles.barLabel}>{d.day}</Text> : null}
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Health</Text>
        <View style={{ marginTop: 12, gap: 14 }}>
          <HealthRow label="Cancellation rate" value={`${cancelRate.toFixed(1)}%`} progress={cancelRate} tone={cancelRate > 10 ? "danger" : "default"} />
          <HealthRow label="Order fulfilment" value={`${(100 - cancelRate).toFixed(1)}%`} progress={100 - cancelRate} tone="default" />
          <HealthRow label="Revenue per order" value={formatPrice(aov)} progress={Math.min(100, aov / 100)} tone="default" />
        </View>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Live signals</Text>
        <View style={styles.signalRow}>
          <View style={styles.signalCell}>
            <Text style={styles.signalLabel}>Abandoned carts</Text>
            {abandonedQ.isLoading ? (
              <Skeleton height={28} />
            ) : (
              <Text style={styles.signalValue}>
                {(abandonedQ.data?.active ?? 0).toLocaleString()}
              </Text>
            )}
            <Text style={styles.signalSub}>active · {(abandonedQ.data?.notified ?? 0).toLocaleString()} notified</Text>
          </View>
          <View style={styles.signalCell}>
            <Text style={styles.signalLabel}>Price alerts</Text>
            {priceQ.isLoading ? (
              <Skeleton height={28} />
            ) : (
              <Text style={styles.signalValue}>
                {(priceQ.data?.active ?? 0).toLocaleString()}
              </Text>
            )}
            <Text style={styles.signalSub}>
              active · {(priceQ.data?.cancelled ?? 0).toLocaleString()} cancelled
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function HealthRow({ label, value, progress, tone }: { label: string; value: string; progress: number; tone: "default" | "danger" }) {
  return (
    <View>
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>
      <ProgressBar value={progress} fillColor={tone === "danger" ? colors.light.destructive : colors.olive[500]} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  rangeRow: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  rangeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  rangeBtnActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  rangeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5 },
  rangeTextActive: { color: "#fff" },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  chartCard: { margin: 20, marginBottom: 0, padding: 16, ...shadows.soft },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  chartTitle: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 1.4, textTransform: "uppercase" },
  chartValue: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: colors.light.foreground, letterSpacing: -0.3 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 2 },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  bar: { width: "100%", backgroundColor: colors.olive[500], borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 9, color: colors.light.mutedForeground, marginTop: 4 },
  healthRow: { flexDirection: "row", justifyContent: "space-between" },
  healthLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground },
  healthValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground },
  signalRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  signalCell: { flex: 1, gap: 6, backgroundColor: colors.olive[50], borderRadius: radii.lg, padding: 14 },
  signalLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 1.2, textTransform: "uppercase" },
  signalValue: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: colors.light.foreground, letterSpacing: -0.5 },
  signalSub: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground },
});
