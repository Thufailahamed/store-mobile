import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreAnalytics } from "@/lib/api";
import type { SellerAnalyticsRange } from "@/lib/api/backend";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip } from "@/components/ui/Chip";
import { RevenueChart } from "@/components/seller/RevenueChart";
import { SellerScreenHeader, SellerStateView } from "@/components/seller/chrome";
import { formatOrderStatusLabel } from "@/lib/orders/seller-list";

const RANGES: Array<{ key: SellerAnalyticsRange; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
];

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

type AnalyticsData = {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgOrderValue: number;
  refundRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; revenue: number; units: number }[];
  ordersByStatus: Record<string, number>;
};

export default function SellerAnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<SellerAnalyticsRange>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextRange: SellerAnalyticsRange = range) => {
      if (!user) return;
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setError(storeRes.ok ? "No store found" : storeRes.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const res = await getStoreAnalytics(storeRes.data.id, nextRange);
      if (!res.ok) {
        setError(res.error);
        setData(null);
      } else {
        setError(null);
        setData(res.data);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [user, range],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(range);
    }, [load, range]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load(range);
  };

  const onRange = (key: SellerAnalyticsRange) => {
    if (key === range) return;
    setRange(key);
    setLoading(true);
    void load(key);
  };

  const statusEntries = STATUS_ORDER.map((key) => ({
    key,
    count: data?.ordersByStatus?.[key] ?? 0,
  })).filter((e) => e.count > 0);
  const statusMax = Math.max(...statusEntries.map((e) => e.count), 1);
  const refundPct = data
    ? data.refundRate <= 1
      ? data.refundRate * 100
      : data.refundRate
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerScreenHeader
        kicker="Performance"
        title="Analytics"
        backLabel="Home"
        backHref="/(seller)"
      />
      <View style={styles.rangeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeRow}
        >
          {RANGES.map((r) => (
            <Chip key={r.key} selected={r.key === range} onPress={() => onRange(r.key)} compact>
              {r.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.body}>
          <Skeleton height={148} borderRadius={radii["2xl"]} />
          <Skeleton height={220} borderRadius={radii["2xl"]} style={{ marginTop: 14 }} />
          <Skeleton height={160} borderRadius={radii["2xl"]} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, { paddingBottom: 120 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <SellerStateView
              variant="error"
              title="Couldn’t load analytics"
              description={error}
              actionLabel="Try again"
              onAction={onRefresh}
            />
          ) : data ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>Revenue · {range.toUpperCase()}</Text>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatPrice(data.totalRevenue)}
                </Text>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaValue}>{data.totalOrders}</Text>
                    <Text style={styles.heroMetaLabel}>{pluralize(data.totalOrders, "order")}</Text>
                  </View>
                  <View style={styles.heroMetaRule} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaValue}>{formatPrice(data.avgOrderValue)}</Text>
                    <Text style={styles.heroMetaLabel}>Avg order</Text>
                  </View>
                  <View style={styles.heroMetaRule} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaValue}>{refundPct.toFixed(1)}%</Text>
                    <Text style={styles.heroMetaLabel}>Refunds</Text>
                  </View>
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHead}>
                  <Text style={styles.panelKicker}>Trend</Text>
                  <Text style={styles.panelTitle}>Sales over time</Text>
                </View>
                <RevenueChart
                  points={data.revenueByMonth.map((p) => ({
                    date: p.month,
                    revenue: p.revenue,
                    orders: p.orders,
                  }))}
                  height={176}
                />
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeadRow}>
                  <View>
                    <Text style={styles.panelKicker}>Bestsellers</Text>
                    <Text style={styles.panelTitle}>Top products</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push("/(seller)/products" as any)}>
                    <Text style={styles.link}>Catalogue</Text>
                  </TouchableOpacity>
                </View>
                {data.topProducts.length === 0 ? (
                  <EmptyState
                    framed={false}
                    icon="cube-outline"
                    title="No product sales yet"
                    description="Bestsellers appear once paid orders start coming in."
                    style={{ paddingVertical: 20 }}
                  />
                ) : (
                  data.topProducts.slice(0, 6).map((p, i) => {
                    const last = i === Math.min(data.topProducts.length, 6) - 1;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.productRow, last && styles.rowLast]}
                        onPress={() => router.push(`/(seller)/products/${p.id}` as any)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.rank}>{String(i + 1).padStart(2, "0")}</Text>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.productMeta}>{formatPrice(p.revenue)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {statusEntries.length > 0 && (
                <View style={styles.panel}>
                  <View style={styles.panelHead}>
                    <Text style={styles.panelKicker}>Pipeline</Text>
                    <Text style={styles.panelTitle}>Orders by status</Text>
                  </View>
                  {statusEntries.map((entry) => (
                    <View key={entry.key} style={styles.statusRow}>
                      <View style={styles.statusMeta}>
                        <Text style={styles.statusName}>{formatOrderStatusLabel(entry.key)}</Text>
                        <Text style={styles.statusCount}>{entry.count}</Text>
                      </View>
                      <View style={styles.statusTrack}>
                        <View
                          style={[
                            styles.statusFill,
                            { width: `${Math.max(8, (entry.count / statusMax) * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <EmptyState
              icon="bar-chart-outline"
              title="No analytics yet"
              description="Metrics appear after your store receives paid orders."
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  rangeBar: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.light.background,
  },
  rangeRow: { gap: 8, paddingRight: 8 },
  scroll: { flex: 1 },
  body: { padding: spacing[5], gap: 14 },
  heroCard: {
    backgroundColor: colors.olive[950],
    borderRadius: radii["2xl"],
    padding: spacing[5],
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
  },
  heroLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.accent2.ochre,
  },
  heroValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    color: colors.paper.cream,
    letterSpacing: -0.8,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(250,248,241,0.12)",
  },
  heroMetaItem: { flex: 1, alignItems: "center", gap: 2 },
  heroMetaRule: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "rgba(200,164,74,0.28)" },
  heroMetaValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.paper.cream,
  },
  heroMetaLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250,248,241,0.55)",
    textTransform: "capitalize",
  },
  panel: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    padding: spacing[4],
    gap: 12,
  },
  panelHead: { gap: 2 },
  panelHeadRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  panelKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  panelTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
  },
  link: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.1)",
    minHeight: 52,
  },
  rowLast: { borderBottomWidth: 0 },
  rank: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: colors.accent2.ochre,
    width: 28,
  },
  productInfo: { flex: 1, gap: 2 },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  productMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
  },
  statusRow: { gap: 6, marginBottom: 10 },
  statusMeta: { flexDirection: "row", justifyContent: "space-between" },
  statusName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  statusCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: colors.ink.mute,
  },
  statusTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  statusFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.olive[700],
  },
});
