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
import { getSellerStore, getSellerOrders } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_TABS: { key: string; label: string; accent?: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", accent: "#f59e0b" },
  { key: "confirmed", label: "Confirmed", accent: "#3b82f6" },
  { key: "processing", label: "Packing", accent: "#6366f1" },
  { key: "shipped", label: "Shipped", accent: "#f59e0b" },
  { key: "delivered", label: "Delivered", accent: "#10b981" },
  { key: "cancelled", label: "Cancelled", accent: "#9ca3af" },
];

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#fef3c7", text: "#92400e" },
  out_for_delivery: { bg: "#f3e8ff", text: "#7c3aed" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
  returned: { bg: "#f3e8ff", text: "#7c3aed" },
  refunded: { bg: "#fce7f3", text: "#be185d" },
};

export default function SellerOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    if (!storeId) {
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) {
        setStoreId(storeRes.data.id);
        const res = await getSellerOrders(storeRes.data.id, { status: statusTab, search });
        if (res.ok) setOrders(res.data);
      }
    } else {
      const res = await getSellerOrders(storeId, { status: statusTab, search });
      if (res.ok) setOrders(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId, statusTab, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const renderOrder = ({ item }: { item: Order }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const itemsCount = item.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
    const ship = item.shipping_address;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/(seller)/orders/${item.id}` as any)}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderMeta}>{formatRelative(item.placed_at)} · {itemsCount} item{itemsCount === 1 ? "" : "s"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>
        {ship && (
          <Text style={styles.orderCustomer} numberOfLines={1}>
            {ship.full_name}{ship.city ? ` · ${ship.city}` : ""}
          </Text>
        )}
        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{formatPrice(item.total)}</Text>
          <Text style={styles.orderPayment}>
            {item.payment_method?.toUpperCase() ?? "—"} · {item.payment_status}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.count}>{orders.length} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by order number..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item: tab }) => {
            const count = tab.key === "all"
              ? orders.length
              : orders.filter((o) => o.status === tab.key).length;
            return (
              <TouchableOpacity
                style={[styles.tab, statusTab === tab.key && styles.tabActive]}
                onPress={() => setStatusTab(tab.key)}
              >
                {tab.accent && statusTab !== tab.key && (
                  <View style={[styles.tabDot, { backgroundColor: tab.accent }]} />
                )}
                <Text style={[styles.tabText, statusTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabCount, statusTab === tab.key && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, statusTab === tab.key && styles.tabCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={orders.filter((o) => statusTab === "all" || o.status === statusTab)}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>No orders here</Text>
            <Text style={styles.emptySub}>Orders will appear in real-time</Text>
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
  count: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
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
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
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
  tabCountText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.mutedForeground,
  },
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
  orderCustomer: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 6,
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
  orderPayment: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
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
