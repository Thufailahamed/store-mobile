import React, { useCallback, useEffect, useState } from "react";
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
import { getSellerStore, getSellerReturns, type SellerReturnRequest } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { ReturnStatus } from "@/lib/account-local";

const STATUS_TABS: { key: string; label: string; accent?: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Pending", accent: "#f59e0b" },
  { key: "approved", label: "Approved", accent: "#3b82f6" },
  { key: "received", label: "Received", accent: "#6366f1" },
  { key: "refunded", label: "Refunded", accent: "#10b981" },
  { key: "rejected", label: "Rejected", accent: "#ef4444" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  requested: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#dbeafe", text: "#1e40af" },
  received: { bg: "#e0e7ff", text: "#3730a3" },
  refunded: { bg: "#dcfce7", text: "#166534" },
  rejected: { bg: "#fee2e2", text: "#b91c1c" },
};

function formatPrice(n: number, currency = "LKR") {
  return `${currency} ${n.toLocaleString("en-LK")}`;
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

export default function SellerReturns() {
  const router = useRouter();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [returns, setReturns] = useState<SellerReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");

  const fetchReturns = useCallback(async () => {
    if (!user) return;
    let sid = storeId;
    if (!sid) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      sid = storeRes.data.id;
      setStoreId(sid);
    }
    const res = await getSellerReturns(sid, { status: statusTab, search });
    if (res.ok) setReturns(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId, statusTab, search]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReturns();
  }, [fetchReturns]);

  const pendingCount = returns.filter((r) => r.status === "requested").length;

  const renderReturn = ({ item }: { item: SellerReturnRequest }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.requested;
    const itemCount = item.items.reduce((s, i) => s + i.quantity, 0);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(seller)/returns/${item.return_group_id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.returnNumber}>{item.return_number}</Text>
            <Text style={styles.meta}>
              {formatRelative(item.created_at)} · Order {item.order_number}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>
        {item.buyer_name ? (
          <Text style={styles.buyer} numberOfLines={1}>
            {item.buyer_name}
          </Text>
        ) : null}
        <Text style={styles.reason} numberOfLines={1}>
          {item.reason}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.items}>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </Text>
          <Text style={styles.refund}>{formatPrice(item.refund_amount, item.currency)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Returns</Text>
        <Text style={styles.count}>
          {pendingCount > 0 ? `${pendingCount} pending · ` : ""}
          {returns.length} total
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search return #, order, buyer..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>

      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item: tab }) => {
            const count =
              tab.key === "all"
                ? returns.length
                : returns.filter((r) => r.status === (tab.key as ReturnStatus)).length;
            return (
              <TouchableOpacity
                style={[styles.tab, statusTab === tab.key && styles.tabActive]}
                onPress={() => setStatusTab(tab.key)}
              >
                {tab.accent && statusTab !== tab.key ? (
                  <View style={[styles.tabDot, { backgroundColor: tab.accent }]} />
                ) : null}
                <Text style={[styles.tabText, statusTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.tabCount, statusTab === tab.key && styles.tabCountActive]}>
                    <Text
                      style={[
                        styles.tabCountText,
                        statusTab === tab.key && styles.tabCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      <FlatList
        data={returns}
        keyExtractor={(item) => item.return_group_id}
        renderItem={renderReturn}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>↩️</Text>
              <Text style={styles.emptyTitle}>No returns here</Text>
              <Text style={styles.emptySub}>Buyer return requests will show up here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  count: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  searchContainer: { paddingHorizontal: 24, paddingVertical: 12 },
  searchInput: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  tabsContainer: { marginBottom: 8 },
  tabsContent: { paddingHorizontal: 24, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    marginRight: 8,
  },
  tabActive: { backgroundColor: colors.light.primary },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },
  tabTextActive: { color: colors.light.primaryForeground },
  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabCountText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.mutedForeground,
  },
  tabCountTextActive: { color: colors.light.primaryForeground },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  returnNumber: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  meta: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  buyer: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    marginBottom: 4,
  },
  reason: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: 10,
  },
  items: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  refund: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
});
