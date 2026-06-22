import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/supabase/auth";
import {
  getDeliveryCompanyMe,
  getDeliveryCompanyPackages,
  getDeliveryCompanyDrivers,
  getDeliveryCompanyWarehouses,
  getDeliveryCompanyTrends,
  getDeliveryCompanyRoutes,
  hasStoreApi,
  type DeliveryCompany,
  type DcTrends,
  type DcRoute,
} from "@/lib/api/delivery-company-api";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function sumLast(arr: number[] | undefined) {
  if (!arr?.length) return 0;
  return arr[arr.length - 1] ?? 0;
}

export default function DeliveryCompanyDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [company, setCompany] = useState<DeliveryCompany | null>(null);
  const [stats, setStats] = useState({
    inHubs: 0,
    pendingAssign: 0,
    activeDrivers: 0,
    warehouses: 0,
    deliveredToday: 0,
    plannedRoutes: 0,
    activeRoutes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [trends, setTrends] = useState<DcTrends | null>(null);
  const [routes, setRoutes] = useState<DcRoute[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setApiError(null);

    if (!hasStoreApi()) {
      setApiError("Set EXPO_PUBLIC_STORE_API_URL to use Logistics HQ.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [me, packages, drivers, warehouses, trendsRes, routesRes] = await Promise.all([
      getDeliveryCompanyMe(),
      getDeliveryCompanyPackages(),
      getDeliveryCompanyDrivers({ active: true, role: "driver" }),
      getDeliveryCompanyWarehouses(),
      getDeliveryCompanyTrends(),
      getDeliveryCompanyRoutes(),
    ]);

    if (me.ok) setCompany(me.data.company);
    else setApiError(me.error);

    const inventory = packages.ok ? packages.data.inventory : [];
    const inHubs = inventory.filter((i) => i.status === "received").length;
    const pendingAssign = inventory.filter(
      (i) => i.status === "received" && i.order && !i.order.delivery_person_id,
    ).length;
    const driverCount = drivers.ok
      ? drivers.data.members.filter((m) => m.company_role === "driver" && m.is_active).length
      : 0;
    const whCount = warehouses.ok ? warehouses.data.warehouses.length : 0;
    const deliveredToday = trendsRes.ok ? sumLast(trendsRes.data.delivered) : 0;
    const routeList = routesRes.ok ? routesRes.data.routes : [];
    setRoutes(routeList);
    if (trendsRes.ok) setTrends(trendsRes.data);
    const plannedRoutes = routeList.filter((r) => r.status === "planned").length;
    const activeRoutes = routeList.filter((r) => r.status === "active").length;

    setStats({
      inHubs,
      pendingAssign,
      activeDrivers: driverCount,
      warehouses: whCount,
      deliveredToday,
      plannedRoutes,
      activeRoutes,
    });
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useCompanyRealtime(company?.id, user?.id, load);

  const activity = useMemo(() => {
    const events: { id: string; title: string; detail: string; at: string; kind: string }[] = [];
    for (const r of routes) {
      for (const s of r.stops ?? []) {
        if (s.status === "delivered" && s.completed_at) {
          events.push({
            id: `d-${s.id}`,
            kind: "delivered",
            title: `Delivered #${s.order?.order_number ?? ""}`,
            detail: r.driver?.full_name ?? "",
            at: s.completed_at,
          });
        } else if (s.status === "failed" && s.completed_at) {
          events.push({
            id: `f-${s.id}`,
            kind: "failed",
            title: `Failed #${s.order?.order_number ?? ""}`,
            detail: r.driver?.full_name ?? "",
            at: s.completed_at,
          });
        }
      }
    }
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [routes]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Logistics HQ</Text>
          <Text style={styles.title}>{company?.name ?? "Delivery Company"}</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="pulse" size={14} color={colors.light.primary} />
          <Text style={styles.badgeText}>Live</Text>
        </View>
      </View>

      {apiError ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={20} color="#dc2626" />
          <Text style={styles.errorText}>{apiError}</Text>
        </View>
      ) : null}

      <View style={styles.kpiGrid}>
        <KpiCard label="In hubs" value={stats.inHubs} icon="archive-outline" />
        <KpiCard label="Pending assign" value={stats.pendingAssign} icon="git-branch-outline" accent />
        <KpiCard label="Planned routes" value={stats.plannedRoutes} icon="map-outline" />
        <KpiCard label="Active routes" value={stats.activeRoutes} icon="navigate-outline" />
        <KpiCard label="Active drivers" value={stats.activeDrivers} icon="bicycle-outline" />
        <KpiCard label="Warehouses" value={stats.warehouses} icon="storefront-outline" />
      </View>

      {stats.deliveredToday > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>Delivered today</Text>
          <Text style={styles.bannerValue}>{stats.deliveredToday}</Text>
        </View>
      ) : null}

      {trends ? (
        <View style={styles.trendsCard}>
          <Text style={styles.sectionTitle}>7-day trends</Text>
          <TrendBars label="Delivered" values={trends.delivered} color={colors.light.primary} />
          <TrendBars label="In hubs" values={trends.in_hubs} color="#d97706" />
          <TrendBars label="Active drivers" values={trends.active_drivers} color="#2563eb" />
        </View>
      ) : null}

      {activity.length > 0 ? (
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          {activity.map((ev) => (
            <View key={ev.id} style={styles.activityRow}>
              <Ionicons
                name={ev.kind === "failed" ? "close-circle-outline" : "checkmark-circle-outline"}
                size={18}
                color={ev.kind === "failed" ? "#dc2626" : colors.light.primary}
              />
              <View style={styles.activityBody}>
                <Text style={styles.activityTitle}>{ev.title}</Text>
                <Text style={styles.activityMeta}>{ev.detail} · {new Date(ev.at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.actions}>
        <ActionTile
          title="Assign drivers"
          subtitle={`${stats.pendingAssign} waiting`}
          icon="git-branch-outline"
          onPress={() => router.push("/(delivery-company)/assignments")}
        />
        <ActionTile
          title="Hub inventory"
          subtitle={`${stats.inHubs} packages`}
          icon="cube-outline"
          onPress={() => router.push("/(delivery-company)/packages")}
        />
        <ActionTile
          title="Driver roster"
          subtitle={`${stats.activeDrivers} active`}
          icon="people-outline"
          onPress={() => router.push("/(delivery-company)/drivers")}
        />
        <ActionTile
          title="Routes"
          subtitle={`${stats.plannedRoutes} planned · ${stats.activeRoutes} active`}
          icon="map-outline"
          onPress={() => router.push("/(delivery-company)/routes")}
        />
        <ActionTile
          title="Warehouses"
          subtitle={`${stats.warehouses} hubs`}
          icon="storefront-outline"
          onPress={() => router.push("/(delivery-company)/warehouses")}
        />
        <ActionTile
          title="Driver scan"
          subtitle="Receive at hub"
          icon="qr-code-outline"
          onPress={() => router.push("/(delivery)/scan")}
        />
      </View>
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, accent && styles.kpiAccent]}>
      <Ionicons name={icon} size={20} color={accent ? colors.light.primary : colors.light.mutedForeground} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function TrendBars({ label, values, color }: { label: string; values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendLabel}>{label}</Text>
      <View style={styles.trendBars}>
        {values.map((v, i) => (
          <View
            key={`${label}-${i}`}
            style={[styles.trendBar, { height: Math.max(4, (v / max) * 48), backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

function ActionTile({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.light.primary} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold,
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.semibold,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.light.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.primary,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#fef2f2",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { flex: 1, fontSize: typography.fontSizes.sm, color: "#991b1b" },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: "47%",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
  },
  kpiAccent: { borderColor: colors.light.primary, backgroundColor: "#f0fdf4" },
  kpiValue: {
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold,
    color: colors.light.foreground,
  },
  kpiLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  banner: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  bannerValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.light.foreground,
  },
  trendsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  trendRow: { marginTop: 10 },
  trendLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 6 },
  trendBars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 52 },
  trendBar: { flex: 1, borderRadius: 3, minHeight: 4 },
  activitySection: { paddingHorizontal: 20, marginBottom: 16 },
  activityRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  activityBody: { flex: 1 },
  activityTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  activityMeta: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wider,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  actions: { paddingHorizontal: 20, gap: 10 },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBody: { flex: 1 },
  actionTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.foreground,
  },
  actionSub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
});
