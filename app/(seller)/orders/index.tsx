import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerOrders, transitionOrderStatus, cancelOrder } from "@/lib/api";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SellerSearchField,
  SellerFilterTab,
  SellerStateView,
  SellerStatusPill,
  SELLER_CREAM,
  SELLER_INK,
  SELLER_RUST,
  sellerBorder,
} from "@/components/seller/chrome";
import {
  countOrderUnits,
  countOrdersByStatus,
  filterSellerOrders,
  firstLineItem,
  formatCheckoutPayment,
  formatOrderStatusLabel,
  formatPaymentStatus,
  readShippingContact,
} from "@/lib/orders/seller-list";
import { orderStatusTone } from "@/lib/seller/status-tones";
import { canSellerCancelOrder, getSellerNextStatus } from "@/lib/order-lifecycle";
import type { Order, OrderStatus } from "@/lib/types";

const RUST = SELLER_RUST;
const CREAM = SELLER_CREAM;
const INK = SELLER_INK;

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
}

function orderMoney(order: Order): string {
  if (!Number.isFinite(order.total)) return "—";
  return formatPrice(order.total, order.currency || "LKR");
}

function OrdersSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skelCard}>
          <Skeleton width={56} height={56} borderRadius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="80%" height={12} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SellerOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string }>();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [listedTotal, setListedTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const incomingSearch = typeof params.search === "string" ? params.search : "";
  const [searchInput, setSearchInput] = useState(incomingSearch);
  const [search, setSearch] = useState(incomingSearch);
  const [statusTab, setStatusTab] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!incomingSearch) return;
    setSearchInput(incomingSearch);
    setSearch(incomingSearch.trim());
  }, [incomingSearch]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    let sid = storeId;
    if (!sid) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoadError(storeRes.ok ? "No store found" : storeRes.error);
        setOrders([]);
        setListedTotal(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      sid = storeRes.data.id;
      setStoreId(sid);
    }
    const res = await getSellerOrders(sid, { limit: 200 });
    if (res.ok) {
      setOrders(res.data.orders);
      setListedTotal(res.data.total);
      setLoadError(null);
    } else {
      setLoadError(res.error);
      setOrders([]);
      setListedTotal(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      if (!storeId || !mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      void fetchOrders();
    }, [storeId, fetchOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchOrders();
  }, [fetchOrders]);

  const handleAdvance = useCallback(async (order: Order) => {
    const next = getSellerNextStatus(order.status);
    if (!next || updatingId) return;
    Alert.alert("Update status?", `Mark ${order.order_number || "order"} as "${formatOrderStatusLabel(next)}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: async () => {
        setUpdatingId(order.id);
        const res = await transitionOrderStatus(order.id, next);
        if (res.ok) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
        } else {
          Alert.alert("Error", res.error);
        }
        setUpdatingId(null);
      } },
    ]);
  }, [updatingId]);

  const handleCancel = useCallback(async (order: Order) => {
    if (updatingId || !canSellerCancelOrder(order.status)) return;
    Alert.alert("Cancel order?", `Cancel ${order.order_number || "order"}? Stock will be restored.`, [
      { text: "Keep", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: async () => {
        setUpdatingId(order.id);
        const res = await cancelOrder(order.id);
        if (res.ok) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" as OrderStatus } : o)));
        } else {
          Alert.alert("Error", res.error);
        }
        setUpdatingId(null);
      } },
    ]);
  }, [updatingId]);

  const counts = useMemo(() => countOrdersByStatus(orders), [orders]);
  const needsFulfillment = (counts.pending ?? 0) + (counts.confirmed ?? 0) + (counts.processing ?? 0);
  const visible = useMemo(
    () => filterSellerOrders(orders, { status: statusTab, search }),
    [orders, statusTab, search],
  );

  const headerCount = useMemo(() => {
    if (loadError) return "—";
    if (search) return `${visible.length} match${visible.length === 1 ? "" : "es"}`;
    if (statusTab !== "all") {
      const label = STATUS_TABS.find((t) => t.key === statusTab)?.label.toLowerCase() ?? "";
      return `${visible.length} ${label}`;
    }
    if (listedTotal != null) return `${listedTotal} total`;
    return `${orders.length} total`;
  }, [loadError, search, statusTab, visible.length, listedTotal, orders.length]);

  const renderOrder = ({ item }: { item: Order }) => {
    const tone = orderStatusTone(item.status);
    const units = countOrderUnits(item.items);
    const ship = readShippingContact(item);
    const line = firstLineItem(item.items);
    const method = formatCheckoutPayment(item.payment_method);
    const payStatus = formatPaymentStatus(item.payment_status);
    const codUnpaid = item.payment_method === "cod" && item.payment_status !== "paid";
    const extraUnits = units != null && units > 1 ? units - 1 : 0;
    const nextStatus = getSellerNextStatus(item.status);

    const busy = updatingId === item.id;
    const canCancel = canSellerCancelOrder(item.status);
    const customerName = ship.name?.trim();

    return (
      <View style={[styles.orderCard, codUnpaid && styles.orderCardUnpaid]}>
        <TouchableOpacity
          style={styles.orderMain}
          onPress={() => router.push(`/(seller)/orders/${item.id}` as const)}
          activeOpacity={0.76}
          accessibilityRole="button"
          accessibilityLabel={`${item.order_number}, ${formatOrderStatusLabel(item.status)}, ${orderMoney(item)}`}
        >
          <View style={styles.orderHeader}>
            <View style={styles.orderIdentity}>
              <Text style={styles.orderNumber} numberOfLines={1}>{item.order_number || "—"}</Text>
              <Text style={styles.orderTime}>{formatRelative(item.placed_at)}</Text>
            </View>
            <SellerStatusPill
              label={formatOrderStatusLabel(item.status)}
              bg={tone.bg}
              color={tone.text}
              dotted={item.status === "pending" || item.status === "processing"}
            />
          </View>

          <View style={styles.productRow}>
            <View style={styles.thumbWrap}>
              {line?.imageUrl ? (
                <Image source={{ uri: line.imageUrl }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="bag-outline" size={21} color={colors.olive[700]} />
                </View>
              )}
              {extraUnits > 0 ? (
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>+{extraUnits}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {line?.name ?? "Order items"}{line?.variant ? ` · ${line.variant}` : ""}
              </Text>
              <Text style={styles.orderMeta} numberOfLines={1}>
                {[customerName, ship.place, `${units ?? 0} item${units === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>

          <View style={styles.orderFooter}>
            <Text style={styles.orderTotal}>{orderMoney(item)}</Text>
            <View style={[styles.paymentPill, codUnpaid && styles.paymentPillWarn]}>
              <Ionicons name={codUnpaid ? "alert-circle-outline" : "checkmark-circle"} size={13} color={codUnpaid ? RUST : colors.olive[700]} />
              <Text style={[styles.orderPayment, codUnpaid && styles.orderPaymentWarn]} numberOfLines={1}>{method} · {payStatus}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {(nextStatus || canCancel) ? (
          <View style={styles.cardActions}>
            {canCancel ? (
              <TouchableOpacity
                style={styles.cancelAction}
                onPress={() => void handleCancel(item)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${item.order_number}`}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
            {nextStatus ? (
              <TouchableOpacity
                style={[styles.primaryAction, busy && styles.primaryActionDisabled]}
                onPress={() => void handleAdvance(item)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
              >
                <Text style={styles.primaryActionText}>{busy ? "Working…" : `Mark as ${formatOrderStatusLabel(nextStatus).toLowerCase()}`}</Text>
                {busy ? null : <Ionicons name="arrow-forward" size={15} color={CREAM} />}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const filtered = statusTab !== "all" || !!searchInput;
  const pipeline: { key: string; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "processing", label: "Packing" },
  ];

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <Text style={styles.headerKicker}>FULFILLMENT</Text>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerCount}>{headerCount}</Text>
        </View>
      </View>

      <View style={styles.fulfillmentCard}>
        <View style={styles.fulfillmentTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fulfillmentLabel}>NEEDS FULFILLMENT</Text>
            <Text style={styles.fulfillmentHint}>
              {needsFulfillment === 0 ? "You’re all caught up" : `${needsFulfillment} ${needsFulfillment === 1 ? "order is" : "orders are"} waiting on you`}
            </Text>
          </View>
          <Text style={styles.fulfillmentValue}>{needsFulfillment}</Text>
        </View>
        <View style={styles.fulfillmentStats}>
          {pipeline.map((stage, index) => {
            const value = counts[stage.key] ?? 0;
            const active = statusTab === stage.key;
            return (
              <React.Fragment key={stage.key}>
                {index > 0 ? <Ionicons name="chevron-forward" size={12} color="#5E5A51" /> : null}
                <TouchableOpacity
                  style={[styles.fulfillmentStat, active && styles.fulfillmentStatActive]}
                  onPress={() => setStatusTab(active ? "all" : stage.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${value} ${stage.label}`}
                >
                  <Text style={[styles.fulfillmentStatValue, value === 0 && styles.fulfillmentStatZero]}>{value}</Text>
                  <Text style={styles.fulfillmentStatLabel}>{stage.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search order, customer, city…"
          accessibilityLabel="Search orders"
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_TABS}
        keyExtractor={(tab) => tab.key}
        renderItem={({ item: tab }) => (
          <SellerFilterTab
            label={tab.label}
            count={counts[tab.key] ?? 0}
            active={statusTab === tab.key}
            onPress={() => setStatusTab(tab.key)}
          />
        )}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      />

      {filtered ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            Showing {visible.length} {visible.length === 1 ? "order" : "orders"}
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setStatusTab("all");
              setSearchInput("");
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Ionicons name="close" size={13} color={colors.olive[800]} />
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {loading && orders.length === 0 ? (
        <>
          {listHeader}
          <OrdersSkeleton />
        </>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
          }
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
          ListEmptyComponent={
            <SellerStateView
              variant={loadError ? "error" : "empty"}
              icon={loadError ? "cloud-offline-outline" : "receipt-outline"}
              title={loadError ? "Couldn’t load orders" : "No orders here"}
              description={
                loadError ??
                (search
                  ? "Nothing matches that search."
                  : "Orders from this store will appear here.")
              }
              actionLabel={loadError ? "Try again" : undefined}
              onAction={loadError ? () => void fetchOrders() : undefined}
              style={{ marginTop: 24, marginHorizontal: spacing[5] }}
            />
          }
        />
      )}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.light.background },
  header: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  headerKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.olive[700], marginBottom: 4 },
  headerTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  headerTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 34, lineHeight: 40, color: INK, letterSpacing: -0.6 },
  headerCount: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.ink.mute },
  fulfillmentCard: { marginHorizontal: spacing[5], marginBottom: 14, padding: 18, paddingBottom: 12, borderRadius: 24, backgroundColor: "#1A1915" },
  fulfillmentTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  fulfillmentLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.2, color: "#AAA396" },
  fulfillmentValue: { fontFamily: fontFamilies.display.semibold, fontSize: 40, lineHeight: 46, color: "#FAF8F1", fontVariant: ["tabular-nums"] },
  fulfillmentHint: { marginTop: 4, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: "#D9D3C7" },
  fulfillmentStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.13)" },
  fulfillmentStat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 14 },
  fulfillmentStatActive: { backgroundColor: "rgba(232,207,143,0.12)" },
  fulfillmentStatValue: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: "#E8CF8F", fontVariant: ["tabular-nums"] },
  fulfillmentStatZero: { color: "#6F6A60" },
  fulfillmentStatLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "#AAA396" },
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: 10 },
  tabsContainer: { flexGrow: 0, marginBottom: spacing[4] },
  tabsContent: { paddingHorizontal: spacing[5], gap: 8 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[5], marginTop: -4, marginBottom: 12 },
  resultsText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.ink.mute },
  clearButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.olive[50] },
  clearButtonText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  orderCard: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: sellerBorder, marginHorizontal: spacing[5], marginBottom: 12, overflow: "hidden" },
  orderCardUnpaid: { borderColor: "rgba(184,92,58,0.3)", backgroundColor: "#FFFBF8" },
  orderMain: { padding: 16 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 },
  orderIdentity: { flex: 1, minWidth: 0, gap: 2 },
  orderNumber: { fontFamily: fontFamilies.mono.semibold, fontSize: 13, color: INK },
  orderTime: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumbWrap: { width: 60, height: 60 },
  thumb: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.olive[50] },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  thumbBadge: { position: "absolute", right: -4, bottom: -4, backgroundColor: INK, borderRadius: radii.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: "#FFFFFF" },
  thumbBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: CREAM },
  productInfo: { flex: 1, minWidth: 0, gap: 4 },
  itemName: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, lineHeight: 20, color: INK },
  orderMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sellerBorder, gap: 10 },
  orderTotal: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: INK, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  paymentPill: { maxWidth: "58%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.olive[50] },
  paymentPillWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  orderPayment: { flexShrink: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[700] },
  orderPaymentWarn: { color: RUST },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  primaryAction: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.olive[900], borderRadius: radii.full, paddingHorizontal: 16 },
  primaryActionDisabled: { opacity: 0.6 },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: CREAM },
  cancelAction: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: radii.full, borderWidth: 1, borderColor: "rgba(184,92,58,0.3)" },
  cancelActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: RUST },
  skelCard: { flexDirection: "row", gap: 12, backgroundColor: CREAM, borderRadius: 22, borderWidth: 1, borderColor: sellerBorder, padding: 14 },
});
