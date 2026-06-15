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
import { useAuth } from "@/lib/supabase/auth";
import { getRiderHistory } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Order } from "@/lib/types";

const RANGES = [
  { key: "all", label: "All time" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
] as const;

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    month: "short", day: "numeric",
  });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
  returned: { bg: "#f3e8ff", text: "#7c3aed" },
  refunded: { bg: "#fce7f3", text: "#be185d" },
};

export default function DeliveryHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<string>("all");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const res = await getRiderHistory(user.id);
    if (res.ok) setOrders(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.order_number?.toLowerCase().includes(q) ||
      o.shipping_address?.full_name?.toLowerCase().includes(q);
    if (range === "all") return matchSearch;
    const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    const when = new Date(o.delivered_at || o.placed_at).getTime();
    return matchSearch && when >= cutoff;
  });

  const stats = {
    delivered: filtered.filter((o) => o.status === "delivered").length,
    codCollected: filtered
      .filter((o) => o.status === "delivered" && o.payment_method === "cod" && o.payment_status === "paid")
      .reduce((s, o) => s + o.total, 0),
    earnings: filtered.filter((o) => o.status === "delivered").length * 350,
  };

  const renderItem = ({ item }: { item: Order }) => {
    const ship = item.shipping_address;
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.delivered;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderDate}>
              {item.delivered_at ? formatDate(item.delivered_at) : formatDate(item.placed_at)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.customerName}>{ship?.full_name ?? "—"}</Text>
        <Text style={styles.customerCity}>{ship?.city ?? ""}</Text>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
          <Text style={styles.paymentMethod}>
            {item.payment_method?.toUpperCase() ?? "—"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Delivery History</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statValue, { color: "#166534" }]}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fef9c3" }]}>
          <Text style={[styles.statValue, { color: "#854d0e" }]}>{formatPrice(stats.codCollected)}</Text>
          <Text style={styles.statLabel}>COD Collected</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#f0f1e8" }]}>
          <Text style={styles.statValue}>{formatPrice(stats.earnings)}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search order or customer..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>

      {/* Range Tabs */}
      <View style={styles.tabsContainer}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.tab, range === r.key && styles.tabActive]}
            onPress={() => setRange(r.key)}
          >
            <Text style={[styles.tabText, range === r.key && styles.tabTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySub}>Completed deliveries appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
    textAlign: "center",
  },

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

  tabsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
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
  orderDate: {
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
  customerName: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    marginTop: 8,
  },
  customerCity: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
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
  paymentMethod: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },

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
