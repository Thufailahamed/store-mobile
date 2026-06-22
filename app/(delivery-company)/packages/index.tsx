import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  assignLastMileBatch,
  getDeliveryCompanyMe,
  getDeliveryCompanyPackages,
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  type DcPackageInventory,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { colors, typography, radii } from "@/lib/theme/tokens";

type TabKey = "all" | "received" | "assigned" | "in_transit" | "delivered" | "failed" | "returned";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "received", label: "In hub" },
  { key: "assigned", label: "Assigned" },
  { key: "in_transit", label: "Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
  { key: "returned", label: "Returned" },
];

type PackageItem =
  | { kind: "inventory"; id: string; status: string; received_at?: string | null; warehouse?: { id: string; name: string } | null; order?: DcPackageInventory["order"] }
  | {
      kind: "route_stop";
      id: string;
      status: string;
      route_id?: string;
      order?: DcPackageInventory["order"];
      driver_name?: string;
    };

function statusStyle(status: string) {
  switch (status) {
    case "received":
      return { bg: "#dcfce7", color: "#166534", label: "In hub" };
    case "assigned":
      return { bg: "#dbeafe", color: "#1d4ed8", label: "Assigned" };
    case "in_transit":
    case "active":
    case "pending":
      return { bg: "#fef9c3", color: "#a16207", label: status.replace(/_/g, " ") };
    case "delivered":
      return { bg: colors.light.muted, color: colors.light.mutedForeground, label: "Delivered" };
    case "failed":
      return { bg: "#fef2f2", color: "#dc2626", label: "Failed" };
    default:
      return { bg: colors.light.muted, color: colors.light.mutedForeground, label: status };
  }
}

export default function CompanyPackagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<DcPackageInventory[]>([]);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [pkgRes, whRes, meRes] = await Promise.all([
      getDeliveryCompanyPackages(),
      getDeliveryCompanyWarehouses(),
      getDeliveryCompanyMe(),
    ]);
    if (meRes.ok) setCompanyId(meRes.data.company.id);
    if (pkgRes.ok) {
      setInventory(pkgRes.data.inventory);
      setRouteStops(pkgRes.data.route_stops as any[]);
    } else setError(pkgRes.error);
    if (whRes.ok) setWarehouses(whRes.data.warehouses);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useCompanyRealtime(companyId, user?.id, load);

  const items = useMemo(() => {
    const list: PackageItem[] = [];
    for (const i of inventory) {
      list.push({
        kind: "inventory",
        id: i.id,
        status: i.status,
        received_at: i.received_at,
        warehouse: i.warehouse,
        order: i.order,
      });
    }
    for (const s of routeStops) {
      if (!s.order) continue;
      list.push({
        kind: "route_stop",
        id: s.id,
        status: s.status,
        route_id: s.route_id,
        order: s.order,
        driver_name: s.route?.driver?.full_name,
      });
    }
    return list;
  }, [inventory, routeStops]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (tab !== "all") {
        if (tab === "received" && item.status !== "received") return false;
        if (tab === "assigned" && item.status !== "assigned") return false;
        if (tab === "in_transit" && !["in_transit", "active", "pending"].includes(item.status)) return false;
        if (tab === "delivered" && item.status !== "delivered") return false;
        if (tab === "failed" && item.status !== "failed") return false;
        if (tab === "returned" && item.status !== "returned") return false;
      }
      if (warehouseId !== "all" && item.kind === "inventory" && item.warehouse?.id !== warehouseId) return false;
      if (!q) return true;
      const o = item.order;
      const hay = `${o?.order_number ?? ""} ${o?.shipping_address?.full_name ?? ""} ${o?.shipping_address?.city ?? ""} ${item.kind === "inventory" ? item.warehouse?.name ?? "" : ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, tab, warehouseId]);

  const handleLastMile = (orderId: string, whId?: string) => {
    if (actingId) return;
    Alert.alert("Assign last mile", "Auto-assign a last-mile driver for this package?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Assign",
        onPress: async () => {
          setActingId(orderId);
          try {
            const res = await assignLastMileBatch([orderId], whId);
            if (!res.ok) Alert.alert("Failed", res.error);
            else {
              Alert.alert("Done", "Last-mile assignment queued.");
              load();
            }
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Packages" showBack={false} />
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, customer, hub…"
          placeholderTextColor={colors.light.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.filters}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, tab === t.key && styles.chipActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.chipText, tab === t.key && styles.chipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {warehouses.length > 0 ? (
        <View style={styles.whFilters}>
          <TouchableOpacity
            style={[styles.whChip, warehouseId === "all" && styles.chipActive]}
            onPress={() => setWarehouseId("all")}
          >
            <Text style={[styles.chipText, warehouseId === "all" && styles.chipTextActive]}>All hubs</Text>
          </TouchableOpacity>
          {warehouses.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.whChip, warehouseId === w.id && styles.chipActive]}
              onPress={() => setWarehouseId(w.id)}
            >
              <Text style={[styles.chipText, warehouseId === w.id && styles.chipTextActive]} numberOfLines={1}>
                {w.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

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
          data={filtered}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No packages</Text>
              <Text style={styles.emptySub}>Inventory will appear when orders arrive at your hubs.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PackageRow
              item={item}
              acting={actingId === item.order?.id}
              onScan={() => {
                if (item.kind === "inventory" && item.status === "received") {
                  const q = new URLSearchParams();
                  if (item.warehouse?.id) q.set("warehouseId", item.warehouse.id);
                  if (item.order?.id) q.set("orderId", item.order.id);
                  const suffix = q.toString() ? `?${q.toString()}` : "";
                  router.push(`/(delivery-company)/warehouses/receive${suffix}` as any);
                  return;
                }
                router.push("/(delivery)/scan");
              }}
              onLastMile={
                item.kind === "inventory" && item.status === "received" && item.order?.id
                  ? () => handleLastMile(item.order!.id, item.warehouse?.id)
                  : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}

function PackageRow({
  item,
  acting,
  onScan,
  onLastMile,
}: {
  item: PackageItem;
  acting: boolean;
  onScan: () => void;
  onLastMile?: () => void;
}) {
  const st = statusStyle(item.status);
  const order = item.order;
  const addr = order?.shipping_address;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNum}>#{order?.order_number ?? "—"}</Text>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      {addr?.full_name ? <Text style={styles.customer}>{addr.full_name}</Text> : null}
      <Text style={styles.meta}>
        {item.kind === "inventory" ? item.warehouse?.name ?? "Hub" : item.driver_name ?? "On route"}
        {" · "}Rs. {(order?.total ?? 0).toLocaleString("en-LK")}
      </Text>
      {item.kind === "inventory" && item.received_at ? (
        <Text style={styles.received}>Received {new Date(item.received_at).toLocaleString()}</Text>
      ) : null}
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onScan}>
          <Ionicons name="qr-code-outline" size={16} color={colors.light.primary} />
          <Text style={styles.actionText}>Scan</Text>
        </TouchableOpacity>
        {onLastMile ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onLastMile} disabled={acting}>
            {acting ? (
              <ActivityIndicator size="small" color={colors.light.primary} />
            ) : (
              <>
                <Ionicons name="bicycle-outline" size={16} color={colors.light.primary} />
                <Text style={styles.actionText}>Last mile</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  whFilters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  whChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    maxWidth: 140,
  },
  chipActive: { backgroundColor: colors.light.primary },
  chipText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  chipTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderNum: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, textTransform: "capitalize" },
  customer: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: 4 },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  received: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  rowActions: { flexDirection: "row", gap: 12, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: typography.fontSizes.sm, color: colors.light.primary, fontWeight: typography.fontWeights.medium },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
});
