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
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { orderStatusTone } from "@/lib/seller/status-tones";
import {
  formatCheckoutPayment,
  formatPaymentStatus,
  firstLineItem,
  countOrderUnits,
} from "@/lib/orders/seller-list";

const RUST = "#7a2f1a";
const CREAM = "#f4f2ea";

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

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const IN_FLIGHT = new Set(["confirmed", "processing", "shipped", "out_for_delivery"]);

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

  const orders = React.useMemo(
    () => (ordersQuery.data ?? []) as Order[],
    [ordersQuery.data],
  );
  const isFiltered = status !== "all" || search.trim().length > 0;

  const summary = React.useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const inFlight = orders.filter((o) => IN_FLIGHT.has(o.status)).length;
    const volume = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    return { pending, inFlight, volume };
  }, [orders]);

  const renderOrder = ({ item }: { item: Order }) => {
    const tone = orderStatusTone(item.status);
    const user = (item as any).user;
    const customerName = user?.full_name ?? user?.email ?? "Direct Customer";
    const customerInitial = customerName.charAt(0).toUpperCase();
    const orderNumber = item.order_number ?? item.id.slice(0, 8).toUpperCase();
    const items = (item as any).items ?? (item as any).order_items;
    const units = countOrderUnits(items) ?? (Array.isArray(items) && items.length > 0 ? items.length : null);
    const line = firstLineItem(items);
    const extraUnits = units != null && units > 1 ? units - 1 : 0;
    const method = formatCheckoutPayment(item.payment_method);
    const payStatus = formatPaymentStatus(item.payment_status);
    const codUnpaid = item.payment_method === "cod" && item.payment_status !== "paid";

    return (
      <View style={[styles.orderCard, codUnpaid && styles.orderCardWarn]}>
        <View style={[styles.statusAccent, { backgroundColor: tone.text }]} />
        <Pressable
          onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: item.id } })}
          style={styles.orderMain}
        >
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

            <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusBadgeText, { color: tone.text }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>

          {/* Middle Row: Product thumbnail & name */}
          {line || units != null ? (
            <View style={styles.productRow}>
              <View style={styles.thumbWrap}>
                {line?.imageUrl ? (
                  <Image
                    source={{ uri: line.imageUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="bag-outline" size={18} color={colors.olive[700]} />
                  </View>
                )}
                {extraUnits > 0 ? (
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>+{extraUnits}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {line?.name ?? "Order items"}
                  {line?.variant ? ` · ${line.variant}` : ""}
                </Text>
                <Text style={styles.itemsSummaryText}>
                  {units ?? 0} {units === 1 ? "item" : "items"} in consignment
                </Text>
              </View>
            </View>
          ) : null}

          {/* Bottom Row: Price & Payment */}
          <View style={styles.orderBottom}>
            <View style={styles.priceWrap}>
              <Text style={styles.priceLabel}>ORDER TOTAL</Text>
              <Text style={styles.orderTotal}>
                {formatPrice(item.total, item.currency ?? "LKR")}
              </Text>
            </View>
            <View style={styles.orderBottomRight}>
              <View style={[styles.paymentPill, codUnpaid && styles.paymentPillWarn]}>
                <Ionicons
                  name={codUnpaid ? "alert-circle-outline" : "checkmark-circle-outline"}
                  size={12}
                  color={codUnpaid ? RUST : colors.olive[700]}
                />
                <Text
                  style={[styles.paymentPillText, codUnpaid && styles.paymentPillTextWarn]}
                  numberOfLines={1}
                >
                  {method} · {payStatus}
                </Text>
              </View>
              <View style={styles.chevronCircle}>
                <Ionicons name="chevron-forward" size={14} color={colors.olive[800]} />
              </View>
            </View>
          </View>
        </Pressable>
      </View>
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

      {/* Fulfilment summary / filtered results bar */}
      {!ordersQuery.isLoading && orders.length > 0 ? (
        isFiltered ? (
          <View style={styles.resultsBar}>
            <Text style={styles.resultsText}>
              {orders.length} {orders.length === 1 ? "order" : "orders"} shown
            </Text>
            <Pressable
              onPress={() => {
                setSearch("");
                setStatus("all");
              }}
              hitSlop={8}
              style={styles.resultsClear}
            >
              <Text style={styles.resultsClearText}>Clear</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>PENDING</Text>
              <Text style={[styles.summaryValue, summary.pending > 0 && styles.summaryValueWarn]}>
                {summary.pending}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>IN FLIGHT</Text>
              <Text style={styles.summaryValue}>{summary.inFlight}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>VISIBLE VOLUME</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {formatPrice(summary.volume)}
              </Text>
            </View>
          </View>
        )
      ) : null}

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

  /* Summary + results bar */
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.olive[900],
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...shadows.soft,
  },
  summaryCell: {
    flex: 1,
    gap: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(244,242,234,0.16)",
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(244,242,234,0.55)",
    letterSpacing: 0.9,
  },
  summaryValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: CREAM,
    letterSpacing: -0.3,
  },
  summaryValueWarn: {
    color: colors.accent2.ochre,
  },
  resultsBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadows.soft,
  },
  resultsText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  resultsClear: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "#e4dfd3",
  },
  resultsClearText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },

  /* Order List */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    overflow: "hidden",
    ...shadows.soft,
  },
  orderCardWarn: {
    borderColor: "rgba(184,92,58,0.45)",
  },
  statusAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  orderMain: {
    padding: 16,
    paddingLeft: 18,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f4f1ea",
  },
  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  thumbEmpty: {
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.olive[800],
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: CREAM,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  itemsSummaryText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },

  orderBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0ece3",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  priceWrap: {
    gap: 2,
  },
  priceLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.olive[700],
    letterSpacing: 1,
  },
  orderTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.olive[900],
    letterSpacing: -0.3,
  },
  orderBottomRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  paymentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    flexShrink: 1,
  },
  paymentPillWarn: {
    backgroundColor: "rgba(184,92,58,0.12)",
  },
  paymentPillText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: colors.olive[800],
  },
  paymentPillTextWarn: {
    color: RUST,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f8f6f0",
    borderWidth: 1,
    borderColor: "#e4dfd3",
    alignItems: "center",
    justifyContent: "center",
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
