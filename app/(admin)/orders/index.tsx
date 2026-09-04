import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

function formatRelative(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
}

function getStatusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
      return { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", label: "Delivered" };
    case "pending":
      return { bg: "#fffbeb", border: "#fde68a", text: "#92400e", label: "Pending" };
    case "processing":
      return { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", label: "Processing" };
    case "confirmed":
      return { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", label: "Confirmed" };
    case "shipped":
      return { bg: "#faf5ff", border: "#e9d5ff", text: "#6b21a8", label: "Shipped" };
    case "cancelled":
      return { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", label: "Cancelled" };
    case "returned":
      return { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239", label: "Returned" };
    default:
      return { bg: "#f5f3f0", border: "#dfdacd", text: "#716d64", label: status };
  }
}

export default function AdminOrders() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", status, search],
    queryFn: async () => {
      const res = await getAdminOrders({ status, search });
      return res.ok ? res.data : [];
    },
    refetchInterval: 30_000,
  });

  const orders = (ordersQuery.data ?? []) as Order[];

  const renderOrder = ({ item }: { item: Order }) => {
    const badge = getStatusStyle(item.status);
    const user = (item as any).user;
    const customerName = user?.full_name ?? user?.email ?? "Direct Customer";
    const customerInitial = customerName.charAt(0).toUpperCase();
    const orderNumber = item.order_number ?? item.id.slice(0, 8).toUpperCase();
    const itemsCount = (item as any).order_items?.length;

    return (
      <Pressable
        onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: item.id } })}
        style={styles.cardPressable}
      >
        <View style={styles.orderCard}>
          {/* Top Row: Customer Avatar & Status */}
          <View style={styles.orderTop}>
            <View style={styles.customerRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{customerInitial}</Text>
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {customerName}
                </Text>
                <Text style={styles.orderMeta}>
                  #{orderNumber} · {formatRelative(item.placed_at ?? (item as any).created_at)}
                </Text>
              </View>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          {/* Middle Row: Items summary if available */}
          {itemsCount ? (
            <View style={styles.itemsSummaryRow}>
              <Ionicons name="cube-outline" size={13} color={colors.olive[700]} />
              <Text style={styles.itemsSummaryText}>
                {itemsCount} {itemsCount === 1 ? "item" : "items"} in consignment
              </Text>
            </View>
          ) : null}

          {/* Bottom Row: Price & Navigation Chevron */}
          <View style={styles.orderBottom}>
            <View style={styles.priceWrap}>
              <Text style={styles.priceLabel}>ORDER TOTAL</Text>
              <Text style={styles.orderTotal}>
                {formatPrice(item.total, item.currency ?? "LKR")}
              </Text>
            </View>
            <View style={styles.viewRow}>
              <Text style={styles.viewDetailsText}>View Order</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.olive[800]} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Editorial Header */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>DISPATCH & FULFILLMENT</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Orders</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{orders.length} orders</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => ordersQuery.refetch()}
          activeOpacity={0.7}
          accessibilityLabel="Refresh orders"
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color={colors.olive[800]}
          />
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.olive[700]}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order #, customer, or phone…"
            placeholderTextColor={colors.light.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.light.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = status === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabChip, isActive && styles.tabChipActive]}
                onPress={() => setStatus(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Order List / Skeleton / Empty State */}
      {ordersQuery.isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonTopRow}>
                <Skeleton width={38} height={38} style={{ borderRadius: 19 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="35%" height={11} />
                </View>
                <Skeleton width={60} height={20} style={{ borderRadius: radii.full }} />
              </View>
              <View style={styles.skeletonBottomRow}>
                <Skeleton width="30%" height={18} />
                <Skeleton width="20%" height={14} />
              </View>
            </View>
          ))}
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={32} color={colors.olive[700]} />
          </View>
          <Text style={styles.emptyTitle}>
            {search || status !== "all" ? "No Matching Orders" : "No Orders Yet"}
          </Text>
          <Text style={styles.emptyDescription}>
            {search || status !== "all"
              ? "No orders match the current keyword or status filter. Try clearing your filters."
              : "When customers place orders, they will stream here in real-time."}
          </Text>
          {search || status !== "all" ? (
            <Pressable
              onPress={() => {
                setSearch("");
                setStatus("all");
              }}
              style={styles.clearFiltersBtn}
            >
              <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderOrder}
          refreshControl={
            <RefreshControl
              refreshing={ordersQuery.isFetching}
              onRefresh={() => ordersQuery.refetch()}
              tintColor={colors.olive[800]}
              colors={[colors.olive[800]]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[700],
  },
  eyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.olive[700],
    letterSpacing: 1.2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.olive[900],
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#ebe7dc",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "#ded8ca",
  },
  countText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.olive[800],
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4dfd3",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.soft,
  },

  /* Search */
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#e4dfd3",
    paddingHorizontal: 14,
    height: 44,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },

  /* Status Tabs */
  tabsContainer: {
    marginBottom: 12,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfdacb",
  },
  tabChipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.olive[900],
  },
  tabTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.bold,
  },

  /* Order List */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  cardPressable: {
    marginBottom: 2,
  },
  orderCard: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    ...shadows.soft,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  avatarText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.olive[900],
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  orderMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  itemsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f4f1ea",
  },
  itemsSummaryText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.olive[800],
  },

  orderBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0ece3",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceWrap: {
    gap: 2,
  },
  priceLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1,
  },
  orderTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.olive[900],
    letterSpacing: -0.3,
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    backgroundColor: "#f8f6f0",
  },
  viewDetailsText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[900],
  },

  /* Skeletons */
  skeletonList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    gap: 12,
  },
  skeletonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0ece3",
  },

  /* Empty State */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ebe7dc",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#dfdacd",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[900],
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.bold,
    color: "#ffffff",
  },
});
