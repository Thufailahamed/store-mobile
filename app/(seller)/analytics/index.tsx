import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreAnalytics } from "@/lib/api";
import { colors, typography, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgOrderValue: number;
  conversionRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  topProducts: { name: string; revenue: number; units: number; image?: string }[];
  ordersByStatus: Record<string, number>;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatShortMonth(month: string) {
  const mm = month.split("-")[1];
  return MONTH_LABELS[mm] ?? mm;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  processing: "#6366f1",
  shipped: "#f59e0b",
  out_for_delivery: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#9ca3af",
  returned: "#a855f7",
  refunded: "#ec4899",
};

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (storeRes.ok && storeRes.data) {
      const res = await getStoreAnalytics(storeRes.data.id);
      if (res.ok) setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="analytics-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  const maxRevenue = Math.max(...(data?.revenueByMonth.map((m) => m.revenue) ?? [1]));

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.heroBg} />
        <View style={s.heroContent}>
          <View style={s.heroTopRow}>
            <View style={s.heroTextBlock}>
              <Text style={s.kicker}>ANALYTICS</Text>
              <Text style={s.heroTitle}>Store Performance</Text>
            </View>
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          </View>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={s.kpiGrid}>
        <View style={[s.kpiCard, { borderLeftColor: colors.olive[600] }]}>
          <View style={[s.kpiIconWrap, { backgroundColor: colors.olive[50] }]}>
            <Ionicons name="wallet-outline" size={20} color={colors.olive[600]} />
          </View>
          <Text style={s.kpiValue}>{formatPrice(data?.totalRevenue ?? 0)}</Text>
          <Text style={s.kpiLabel}>Total Revenue</Text>
        </View>
        <View style={[s.kpiCard, { borderLeftColor: colors.accent2.ochre }]}>
          <View style={[s.kpiIconWrap, { backgroundColor: "#fef9c3" }]}>
            <Ionicons name="receipt-outline" size={20} color={colors.accent2.ochre} />
          </View>
          <Text style={s.kpiValue}>{data?.totalOrders ?? 0}</Text>
          <Text style={s.kpiLabel}>Total Orders</Text>
        </View>
        <View style={[s.kpiCard, { borderLeftColor: colors.accent2.rust }]}>
          <View style={[s.kpiIconWrap, { backgroundColor: "#fef2f2" }]}>
            <Ionicons name="cube-outline" size={20} color={colors.accent2.rust} />
          </View>
          <Text style={s.kpiValue}>{data?.totalProducts ?? 0}</Text>
          <Text style={s.kpiLabel}>Products</Text>
        </View>
        <View style={[s.kpiCard, { borderLeftColor: colors.olive[400] }]}>
          <View style={[s.kpiIconWrap, { backgroundColor: colors.olive[50] }]}>
            <Ionicons name="trending-up-outline" size={20} color={colors.olive[400]} />
          </View>
          <Text style={s.kpiValue}>{formatPrice(data?.avgOrderValue ?? 0)}</Text>
          <Text style={s.kpiLabel}>Avg. Order Value</Text>
        </View>
      </View>

      {/* Conversion Rate */}
      <View style={s.conversionCard}>
        <View style={s.conversionLeft}>
          <Ionicons name="flash-outline" size={20} color={colors.olive[600]} />
          <Text style={s.conversionLabel}>Conversion Rate</Text>
        </View>
        <Text style={s.conversionValue}>{data?.conversionRate ?? 0}%</Text>
      </View>

      {/* Revenue Chart */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Revenue Trend</Text>
        <View style={s.chartCard}>
          {(data?.revenueByMonth ?? []).length === 0 ? (
            <View style={s.emptyChart}>
              <Ionicons name="bar-chart-outline" size={28} color={colors.light.mutedForeground} />
              <Text style={s.emptyChartText}>No revenue data yet</Text>
            </View>
          ) : (
            <View style={s.chart}>
              {(data?.revenueByMonth ?? []).map((m, i) => {
                const barHeight = maxRevenue > 0 ? (m.revenue / maxRevenue) * 120 : 0;
                return (
                  <View key={i} style={s.chartCol}>
                    <Text style={s.chartBarLabel}>
                      {m.revenue >= 1000 ? `${Math.round(m.revenue / 1000)}k` : m.revenue}
                    </Text>
                    <View style={s.chartBarWrap}>
                      <View style={[s.chartBar, { height: Math.max(4, barHeight) }]} />
                    </View>
                    <Text style={s.chartMonth}>{formatShortMonth(m.month)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Order Status Breakdown */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Orders by Status</Text>
        <View style={s.statusGrid}>
          {Object.entries(data?.ordersByStatus ?? {}).map(([status, count]) => (
            <View key={status} style={s.statusTile}>
              <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[status] ?? colors.light.mutedForeground }]} />
              <Text style={s.statusCount}>{count}</Text>
              <Text style={s.statusLabel}>{status.replace(/_/g, " ")}</Text>
            </View>
          ))}
          {Object.keys(data?.ordersByStatus ?? {}).length === 0 && (
            <Text style={s.emptyText}>No order data yet</Text>
          )}
        </View>
      </View>

      {/* Top Products */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Top Products</Text>
        {(data?.topProducts ?? []).length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="trophy-outline" size={28} color={colors.light.mutedForeground} />
            <Text style={s.emptyText}>No sales data yet</Text>
          </View>
        ) : (
          (data?.topProducts ?? []).map((p, i) => (
            <View key={i} style={s.productRow}>
              <View style={s.rankBadge}>
                <Text style={s.rankText}>{i + 1}</Text>
              </View>
              <View style={s.productInfo}>
                <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.productMeta}>{p.units} units sold</Text>
              </View>
              <Text style={s.productRevenue}>{formatPrice(p.revenue)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 20 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: colors.light.background },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },

  header: { position: "relative", marginBottom: 20 },
  heroBg: {
    position: "absolute", top: 0, left: 0, right: 0, height: 140,
    backgroundColor: colors.olive[600],
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroTextBlock: { flex: 1 },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
    color: colors.olive[200], marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: "#fff",
  },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full,
    marginTop: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" },
  liveText: { fontSize: 10, fontWeight: typography.fontWeights.bold as any, color: "#fff", letterSpacing: 1 },

  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingHorizontal: 24, marginBottom: 16,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 60) / 2,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 16, borderLeftWidth: 3,
  },
  kpiIconWrap: {
    width: 36, height: 36, borderRadius: radii.lg,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  kpiValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground, marginBottom: 2,
  },
  kpiLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: 0.3,
  },

  conversionCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 16, marginHorizontal: 24, marginBottom: 24,
  },
  conversionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  conversionLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  conversionValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[600],
  },

  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: colors.light.mutedForeground, marginBottom: 12,
  },

  chartCard: {
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 20,
  },
  emptyChart: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyChartText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 180, paddingTop: 24 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartBarLabel: { fontSize: 9, color: colors.light.mutedForeground, fontWeight: typography.fontWeights.medium as any },
  chartBarWrap: { width: "100%", height: 120, justifyContent: "flex-end" },
  chartBar: {
    width: "100%", borderRadius: radii.sm,
    backgroundColor: colors.olive[500],
    minHeight: 4,
  },
  chartMonth: {
    fontSize: 10, color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },

  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statusTile: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.light.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.light.border,
    paddingHorizontal: 12, paddingVertical: 10, minWidth: 100,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusCount: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  statusLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textTransform: "capitalize", flex: 1,
  },

  emptyCard: {
    alignItems: "center", paddingVertical: 32, gap: 8,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
  },
  emptyText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },

  productRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.light.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 14, marginBottom: 10,
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.olive[600],
    justifyContent: "center", alignItems: "center",
  },
  rankText: { fontSize: 12, fontWeight: typography.fontWeights.bold as any, color: "#fff" },
  productInfo: { flex: 1 },
  productName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground, marginBottom: 2,
  },
  productMeta: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  productRevenue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[600],
  },
});
