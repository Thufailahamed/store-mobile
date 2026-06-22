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
import { useRiderRealtime } from "@/lib/hooks/useRiderRealtime";
import { useTheme } from "@/lib/hooks/useTheme";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { typography, radii } from "@/lib/theme/tokens";
import {
  formatPrice,
  formatRelative,
  elapsedMs,
  urgencyLabel,
  isCompleted,
  STATUS_COLORS,
} from "@/lib/utils/delivery-format";
import {
  filterOrders,
  countByFilter,
  type OrdersFilter,
} from "@/lib/utils/rider-filters";
import type { Order } from "@/lib/types";

const FILTERS: { key: OrdersFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned" },
  { key: "out_for_delivery", label: "Active" },
  { key: "completed", label: "Completed" },
];

export default function DeliveryOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrdersFilter>("assigned");

  const styles = makeStyles(colors, isDark);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const res = await getRiderOrders(user.id);
    if (res.ok) setOrders(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useRiderRealtime(user?.id, fetchOrders);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const filtered = filterOrders(orders, search, filter);
  const counts = countByFilter(orders);

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
      <ScreenHeader
        title="Deliveries"
        showBack={false}
        right={
          <View style={{ justifyContent: "center", height: "100%", paddingRight: 12 }}>
            <Text style={{ fontSize: typography.fontSizes.sm, color: colors.mutedForeground }}>
              {orders.length} total
            </Text>
          </View>
        }
      />

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, name, or city..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No deliveries here</Text>
              <Text style={styles.emptySub}>New assignments appear in real-time</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const makeStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  isDark: boolean,
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

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
      color: colors.foreground,
    },
    count: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground },

    searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
    searchInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 12,
      fontSize: typography.fontSizes.sm,
      color: colors.foreground,
    },

    tabsContainer: { marginBottom: 8 },
    tabsContent: { paddingHorizontal: 16, gap: 8 },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
      fontWeight: typography.fontWeights.medium as any,
    },
    tabTextActive: { color: colors.primaryForeground },
    tabCount: {
      backgroundColor: colors.muted,
      borderRadius: radii.full,
      paddingHorizontal: 6,
      paddingVertical: 1,
      minWidth: 20,
      alignItems: "center",
    },
    tabCountActive: { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.25)" },
    tabCountText: { fontSize: 10, fontWeight: typography.fontWeights.bold as any, color: colors.mutedForeground },
    tabCountTextActive: { color: colors.primaryForeground },

    listContent: { padding: 16, paddingTop: 8 },

    orderCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.foreground,
      fontFamily: "monospace",
    },
    orderMeta: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
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
      color: colors.mutedForeground,
      marginTop: 8,
    },
    orderFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    orderTotal: {
      fontSize: typography.fontSizes.base,
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
    },
    orderBadges: { flexDirection: "row", gap: 6 },
    codBadge: { backgroundColor: isDark ? "#3a2a0a" : "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
    codText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any, color: isDark ? "#fbbf24" : "#92400e" },
    urgencyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
    urgencyText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any },

    emptyContainer: { alignItems: "center", paddingVertical: 48 },
    emptyIcon: { fontSize: 48 },
    emptyTitle: {
      fontSize: typography.fontSizes.base,
      fontWeight: typography.fontWeights.semibold as any,
      color: colors.foreground,
      marginTop: 12,
    },
    emptySub: {
      fontSize: typography.fontSizes.sm,
      color: colors.mutedForeground,
      marginTop: 4,
    },
  });
