import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { getRiderOrders } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Order } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned" },
  { key: "out_for_delivery", label: "Active" },
  { key: "completed", label: "Completed" },
] as const;

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function elapsedMs(iso: string) {
  return Date.now() - new Date(iso).getTime();
}

function urgencyLabel(ms: number) {
  const mins = ms / 60000;
  if (mins < 30) return { label: "Fresh", color: "#16a34a", bg: "#dcfce7" };
  if (mins < 90) return { label: "On time", color: "#d97706", bg: "#fef9c3" };
  if (mins < 180) return { label: "Aging", color: "#ea580c", bg: "#fff7ed" };
  return { label: "Late", color: "#dc2626", bg: "#fef2f2" };
}

function isCompleted(s: string) {
  return ["delivered", "returned", "refunded", "cancelled"].includes(s);
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#fef3c7", text: "#92400e" },
  out_for_delivery: { bg: "#dcfce7", text: "#166534" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
  returned: { bg: "#f3e8ff", text: "#7c3aed" },
  refunded: { bg: "#fce7f3", text: "#be185d" },
};

export default function DeliveryOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("assigned");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const res = await getRiderOrders(user.id);
    if (res.ok) setOrders(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.shipping_address?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.shipping_address?.city?.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    if (filter === "assigned") matchFilter = !isCompleted(o.status) && o.status !== "out_for_delivery";
    else if (filter === "out_for_delivery") matchFilter = o.status === "out_for_delivery";
    else if (filter === "completed") matchFilter = isCompleted(o.status);
    return matchSearch && matchFilter;
  });

  const counts = {
    all: orders.length,
    assigned: orders.filter((o) => !isCompleted(o.status) && o.status !== "out_for_delivery").length,
    out_for_delivery: orders.filter((o) => o.status === "out_for_delivery").length,
    completed: orders.filter((o) => isCompleted(o.status)).length,
  };

  const renderItem = ({ item }: { item: Order }) => {
    const ship = item.shipping_address;
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const isCOD = item.payment_method === "cod" && item.payment_status !== "paid";
    const elapsed = elapsedMs(item.placed_at);
    const urg = urgencyLabel(elapsed);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/(delivery)/orders/${item.id}` as any)}
      >
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderMeta}>
              {ship?.full_name ?? "Customer"} · {formatRelative(item.placed_at)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <Text style={styles.orderAddress} numberOfLines={1}>
          📍 {ship?.line1}, {ship?.city}
        </Text>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
          <View style={styles.orderBadges}>
            {isCOD && (
              <View style={styles.codBadge}>
                <Text style={styles.codText}>COD</Text>
              </View>
            )}
            {!isCompleted(item.status) && item.status !== "out_for_delivery" && (
              <View style={[styles.urgencyBadge, { backgroundColor: urg.bg }]}>
                <Text style={[styles.urgencyText, { color: urg.color }]}>{urg.label}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Deliveries</Text>
        <Text style={styles.count}>{orders.length} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, name, or city..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              style={[styles.tab, filter === tab.key && styles.tabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.tabCount, filter === tab.key && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, filter === tab.key && styles.tabCountTextActive]}>
                  {counts[tab.key as keyof typeof counts]}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No deliveries here</Text>
            <Text style={styles.emptySub}>New assignments appear in real-time</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  count: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },

  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },

  tabsContainer: { marginBottom: 8 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },
  tabTextActive: { color: colors.light.card },
  tabCount: {
    backgroundColor: colors.light.muted,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabCountText: { fontSize: 10, fontWeight: typography.fontWeights.bold as any, color: colors.light.mutedForeground },
  tabCountTextActive: { color: colors.light.card },

  listContent: { padding: 16, paddingTop: 8 },

  orderCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderNumber: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    fontFamily: "monospace",
  },
  orderMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  orderAddress: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  orderTotal: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  orderBadges: { flexDirection: "row", gap: 6 },
  codBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
  codText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any, color: "#92400e" },
  urgencyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
  urgencyText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any },

  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginTop: 12,
  },
  emptySub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
});
