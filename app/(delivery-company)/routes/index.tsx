import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyMe,
  getDeliveryCompanyRoutes,
  hasStoreApi,
  type DcRoute,
} from "@/lib/api/delivery-company-api";
import { useAuth } from "@/lib/supabase/auth";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { useIsTablet } from "@/lib/hooks/useIsTablet";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_FILTERS = ["all", "planned", "active", "completed", "cancelled"] as const;

function routeStatusStyle(status: string) {
  switch (status) {
    case "planned":
      return { bg: "#dbeafe", color: "#1d4ed8", label: "Planned" };
    case "active":
      return { bg: "#dcfce7", color: "#166534", label: "Active" };
    case "completed":
      return { bg: colors.light.muted, color: colors.light.mutedForeground, label: "Done" };
    case "cancelled":
      return { bg: "#fef2f2", color: "#dc2626", label: "Cancelled" };
    default:
      return { bg: colors.light.muted, color: colors.light.mutedForeground, label: status };
  }
}

export default function CompanyRoutesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTablet = useIsTablet();
  const params = useLocalSearchParams<{ driverId?: string; driverName?: string }>();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<DcRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [error, setError] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<{ id: string; name?: string } | null>(
    params.driverId ? { id: params.driverId, name: params.driverName } : null,
  );

  // A driverId param arrives when navigating here from a driver's profile
  // ("View routes") — keep the filter in sync if that param changes.
  useEffect(() => {
    if (params.driverId) setDriverFilter({ id: params.driverId, name: params.driverName });
  }, [params.driverId, params.driverName]);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const meRes = await getDeliveryCompanyMe();
    if (meRes.ok) setCompanyId(meRes.data.company.id);
    const res = await getDeliveryCompanyRoutes({
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(driverFilter?.id ? { driver_id: driverFilter.id } : {}),
    });
    if (res.ok) setRoutes(res.data.routes);
    else setError(res.error);
    setLoading(false);
    setRefreshing(false);
  }, [statusFilter, driverFilter?.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Keep the list current after dispatch/cancel actions taken from the route
  // detail screen — mirrors the realtime-refresh pattern used by the other
  // list screens in this portal (drivers, packages, warehouses).
  useCompanyRealtime(companyId, user?.id, load);

  const planned = routes.filter((r) => r.status === "planned").length;
  const active = routes.filter((r) => r.status === "active").length;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Routes" showBack={false} />
      <Text style={styles.subtitle}>
        {planned} planned · {active} active
      </Text>
      {driverFilter ? (
        <View style={styles.driverFilterRow}>
          <Ionicons name="person-outline" size={14} color={colors.light.primary} />
          <Text style={styles.driverFilterText} numberOfLines={1}>
            Filtered to {driverFilter.name ?? "driver"}
          </Text>
          <TouchableOpacity onPress={() => setDriverFilter(null)} hitSlop={8}>
            <Text style={styles.driverFilterClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {s === "all" ? "All" : s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          key={isTablet ? "grid-2" : "grid-1"}
          data={routes}
          keyExtractor={(item) => item.id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No routes</Text>
              <Text style={styles.emptySub}>Routes appear when you assign orders to drivers.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, isTablet && styles.gridItem]}
              onPress={() => router.push(`/(delivery-company)/routes/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <RouteRow route={item} />
              <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function RouteRow({ route }: { route: DcRoute }) {
  const st = routeStatusStyle(route.status);
  const stops = route.stops?.length ?? route.total_stops ?? 0;
  const kind = route.route_kind?.replace(/_/g, " ") ?? "delivery";

  return (
    <View style={styles.cardBody}>
      <View style={styles.cardTop}>
        <Text style={styles.driverName}>{route.driver?.full_name ?? "Driver"}</Text>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {stops} stop{stops === 1 ? "" : "s"} · {kind}
        {route.warehouse?.name ? ` · ${route.warehouse.name}` : ""}
      </Text>
      <Text style={styles.date}>{new Date(route.created_at).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  driverFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  driverFilterText: {
    flex: 1,
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium,
  },
  driverFilterClear: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.semibold,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  chipActive: { backgroundColor: colors.light.primary },
  chipText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "capitalize" },
  chipTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  columnWrapper: { gap: 12 },
  gridItem: { flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  driverName: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.foreground,
    flex: 1,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  date: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
});
