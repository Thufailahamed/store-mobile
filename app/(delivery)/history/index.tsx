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
import { useTheme } from "@/lib/hooks/useTheme";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { typography, radii } from "@/lib/theme/tokens";
import { formatPrice, formatDateShort as formatDate, STATUS_COLORS } from "@/lib/utils/delivery-format";
import type { Order } from "@/lib/types";

const RANGES = [
  { key: "all", label: "All time" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
] as const;

export default function DeliveryHistory() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<string>("all");

  const styles = makeStyles(colors, isDark);

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
      <ScreenHeader title="Delivery History" showBack={false} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statDelivered]}>
          <Text style={[styles.statValue, styles.statDeliveredText]}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statCard, styles.statCod]}>
          <Text style={[styles.statValue, styles.statCodText]}>{formatPrice(stats.codCollected)}</Text>
          <Text style={styles.statLabel}>COD Collected</Text>
        </View>
        <View style={[styles.statCard, styles.statEarnings]}>
          <Text style={styles.statValue}>{formatPrice(stats.earnings)}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search order or customer..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySub}>Completed deliveries appear here</Text>
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
      padding: 16,
      paddingBottom: 8,
    },
    title: {
      fontSize: typography.fontSizes.xl,
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
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
    statDelivered: { backgroundColor: isDark ? "#0f2e1f" : "#dcfce7" },
    statDeliveredText: { color: isDark ? "#4ade80" : "#166534" },
    statCod: { backgroundColor: isDark ? "#3a2a0a" : "#fef9c3" },
    statCodText: { color: isDark ? "#fbbf24" : "#854d0e" },
    statEarnings: { backgroundColor: colors.muted },
    statValue: {
      fontSize: 18,
      fontWeight: typography.fontWeights.bold as any,
      color: colors.foreground,
    },
    statLabel: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
      marginTop: 2,
      textAlign: "center",
    },

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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
    orderDate: {
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
    customerName: {
      fontSize: typography.fontSizes.sm,
      color: colors.foreground,
      marginTop: 8,
    },
    customerCity: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
      marginTop: 2,
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
    paymentMethod: {
      fontSize: typography.fontSizes.xs,
      color: colors.mutedForeground,
      fontWeight: typography.fontWeights.medium as any,
    },

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
