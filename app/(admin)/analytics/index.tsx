import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { Card, ProgressBar, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { supabase } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { getAdminAbandonedCartsStats, getAdminPriceAlertsStats } from "@/lib/api";

const RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
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
      return r.ok ? (r.data as any) : null;
    },
  });

  const priceQ = useQuery({
    queryKey: ["admin-price-alerts-stats"],
    queryFn: async () => {
      const r = await getAdminPriceAlertsStats();
      return r.ok ? (r.data as any) : null;
    },
  });

  // Daily series for revenue bar chart
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const dayRevenue = revenue
      .filter((r: any) => r.placed_at?.slice(0, 10) === key)
      .reduce((s, r: any) => s + Number(r.total ?? 0), 0);
    return { key, value: dayRevenue, day: d.getDate() };
  });
  const maxDaily = Math.max(1, ...daily.map((d) => d.value));

  // Determine tick interval for X axis
  const tickInterval = days <= 7 ? 1 : days <= 30 ? 5 : 15;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>ANALYTICS</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE SYNC</Text>
          </View>
        </View>
        <Text style={styles.title}>Performance</Text>
        <Text style={styles.subtitle}>Financial telemetry & store conversion indicators</Text>
      </View>

      {/* Range Segmented Selector */}
      <View style={styles.rangeContainer}>
        <View style={styles.rangeTrack}>
          {RANGES.map((r) => {
            const isActive = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.rangeTab, isActive && styles.rangeTabActive]}
              >
                <Text style={[styles.rangeLabel, isActive && styles.rangeLabelActive]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 2x2 KPI Grid */}
      {statsQ.isLoading ? (
        <View style={styles.kpiGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.kpiCard}>
              <Skeleton width="40%" height={12} />
              <Skeleton width="70%" height={24} style={{ marginTop: 8 }} />
              <Skeleton width="50%" height={10} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>TOTAL REVENUE</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: colors.olive[100] }]}>
                <Ionicons name="wallet-outline" size={14} color={colors.olive[700]} />
              </View>
            </View>
            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatPrice(totalRevenue)}
            </Text>
            <Text style={styles.kpiSub}>Paid transactions</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>ORDERS</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#dde4d6" }]}>
                <Ionicons name="receipt-outline" size={14} color={colors.olive[800]} />
              </View>
            </View>
            <Text style={styles.kpiValue}>{orders.length.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>{cancelled} cancelled</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>NEW SIGNUPS</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#fdf3d7" }]}>
                <Ionicons name="people-outline" size={14} color="#7a5b1a" />
              </View>
            </View>
            <Text style={styles.kpiValue}>{signups.length.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>Registered customers</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>AVG ORDER VALUE</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#fbe5dc" }]}>
                <Ionicons name="trending-up-outline" size={14} color="#7a2f1a" />
              </View>
            </View>
            <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatPrice(aov)}
            </Text>
            <Text style={styles.kpiSub}>Across all orders</Text>
          </View>
        </View>
      )}

      {/* Revenue Chart Card */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartEyebrow}>REVENUE VOLUME</Text>
            <Text style={styles.chartMainValue}>{formatPrice(totalRevenue)}</Text>
          </View>
          <View style={styles.chartBadge}>
            <Ionicons name="bar-chart-outline" size={12} color={colors.olive[700]} />
            <Text style={styles.chartBadgeText}>{range.toUpperCase()}</Text>
          </View>
        </View>

        {/* The Bars */}
        <View style={styles.barsRow}>
          {daily.map((d, i) => {
            const h = (d.value / maxDaily) * 100;
            const isNonZero = d.value > 0;
            return (
              <View key={i} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(isNonZero ? 8 : 2, h)}%`,
                        backgroundColor: isNonZero ? colors.olive[600] : colors.olive[100] + "88",
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* X-Axis Date Ticks */}
        <View style={styles.xAxisRow}>
          {daily.map((d, i) => {
            const showTick = i % tickInterval === 0 || i === daily.length - 1;
            return (
              <View key={i} style={styles.xTickWrap}>
                {showTick ? <Text style={styles.xTickText}>{d.day}</Text> : null}
              </View>
            );
          })}
        </View>
      </Card>

      {/* Health / Conversion Metrics */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Platform Health</Text>
          <Text style={styles.sectionSub}>Fulfillment & quality metrics</Text>
        </View>
        <View style={styles.healthList}>
          <HealthItem
            label="Order Fulfilment"
            value={`${(100 - cancelRate).toFixed(1)}%`}
            description="Successfully completed or active deliveries"
            progress={100 - cancelRate}
            tone="success"
          />
          <HealthItem
            label="Cancellation Rate"
            value={`${cancelRate.toFixed(1)}%`}
            description="Cancelled by user or inventory shortfall"
            progress={cancelRate}
            tone={cancelRate > 10 ? "danger" : "default"}
          />
          <HealthItem
            label="Average Basket Share"
            value={formatPrice(aov)}
            description="Average monetary contribution per basket"
            progress={Math.min(100, Math.max(10, (aov / 20000) * 100))}
            tone="default"
          />
        </View>
      </Card>

      {/* Live Signals */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Demand Telemetry</Text>
          <Text style={styles.sectionSub}>Intent signals & recovered opportunities</Text>
        </View>
        <View style={styles.signalsGrid}>
          <View style={styles.signalCard}>
            <View style={styles.signalTop}>
              <View style={[styles.signalIcon, { backgroundColor: "#fdf3d7" }]}>
                <Ionicons name="cart-outline" size={16} color="#7a5b1a" />
              </View>
              <Text style={styles.signalTag}>RECOVERABLE</Text>
            </View>
            <Text style={styles.signalNumber}>
              {abandonedQ.isLoading ? "—" : (abandonedQ.data?.active ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.signalTitle}>Abandoned Carts</Text>
            <Text style={styles.signalDetail}>
              {(abandonedQ.data?.notified ?? 0).toLocaleString()} nudges dispatched
            </Text>
          </View>

          <View style={styles.signalCard}>
            <View style={styles.signalTop}>
              <View style={[styles.signalIcon, { backgroundColor: "#dde4d6" }]}>
                <Ionicons name="pricetag-outline" size={16} color={colors.olive[700]} />
              </View>
              <Text style={styles.signalTag}>WISHLIST</Text>
            </View>
            <Text style={styles.signalNumber}>
              {priceQ.isLoading ? "—" : (priceQ.data?.active ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.signalTitle}>Price Alerts</Text>
            <Text style={styles.signalDetail}>
              {(priceQ.data?.cancelled ?? 0).toLocaleString()} alerts executed
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function HealthItem({
  label,
  value,
  description,
  progress,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  progress: number;
  tone: "default" | "danger" | "success";
}) {
  const fillColor =
    tone === "danger"
      ? colors.light.destructive
      : tone === "success"
      ? colors.olive[600]
      : colors.olive[500];

  return (
    <View style={styles.healthItem}>
      <View style={styles.healthHeader}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={[styles.healthValue, tone === "danger" && { color: colors.light.destructive }]}>
          {value}
        </Text>
      </View>
      <Text style={styles.healthDesc}>{description}</Text>
      <ProgressBar value={progress} fillColor={fillColor} style={styles.healthBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  liveLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[800],
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },

  /* Range Selector */
  rangeContainer: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  rangeTrack: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: radii.full,
  },
  rangeTabActive: {
    backgroundColor: colors.light.primary,
  },
  rangeLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  rangeLabelActive: {
    color: "#fff",
  },

  /* 2x2 KPI Grid */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  kpiCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  kpiTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    letterSpacing: -0.4,
    marginTop: 10,
  },
  kpiSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 3,
  },

  /* Chart Card */
  chartCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  chartEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
  chartMainValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  chartBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  chartBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[700],
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 110,
    gap: 3,
  },
  barColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f5f5f0",
    borderRadius: 3,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 3,
  },
  xAxisRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  xTickWrap: {
    flex: 1,
    alignItems: "center",
  },
  xTickText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    color: colors.light.mutedForeground,
  },

  /* Sections */
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  sectionHead: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: colors.light.foreground,
  },
  sectionSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  /* Health items */
  healthList: {
    gap: 14,
  },
  healthItem: {
    paddingVertical: 2,
  },
  healthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  healthLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  healthValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  healthDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  healthBar: {
    marginTop: 6,
  },

  /* Signals */
  signalsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  signalCard: {
    flex: 1,
    backgroundColor: colors.light.background,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  signalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signalIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  signalTag: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
  },
  signalNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
    letterSpacing: -0.5,
    marginTop: 10,
  },
  signalTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.foreground,
    marginTop: 2,
  },
  signalDetail: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
});
