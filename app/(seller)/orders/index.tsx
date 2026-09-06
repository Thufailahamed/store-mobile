import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
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
import { getSellerStore, getSellerOrders } from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SellerScreenHeader,
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
import type { Order } from "@/lib/types";

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

  const counts = useMemo(() => countOrdersByStatus(orders), [orders]);
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

    const metaBits = [
      formatRelative(item.placed_at),
      units != null ? `${units} item${units === 1 ? "" : "s"}` : null,
      ship.name,
      ship.place,
    ].filter(Boolean);

    return (
      <TouchableOpacity
        style={[styles.orderCard, codUnpaid && styles.orderCardUnpaid]}
        onPress={() => router.push(`/(seller)/orders/${item.id}` as const)}
        accessibilityRole="button"
        accessibilityLabel={`${item.order_number}, ${formatOrderStatusLabel(item.status)}, ${orderMoney(item)}`}
      >
        <View style={styles.thumbWrap}>
          {line?.imageUrl ? (
            <Image source={{ uri: line.imageUrl }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="bag-outline" size={20} color={colors.olive[700]} />
            </View>
          )}
          {extraUnits > 0 ? (
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText}>+{extraUnits}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.orderBody}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber} numberOfLines={1}>
              {item.order_number || "—"}
            </Text>
            <SellerStatusPill
              label={formatOrderStatusLabel(item.status)}
              bg={tone.bg}
              color={tone.text}
              dotted={item.status === "pending" || item.status === "processing"}
            />
          </View>
          <Text style={styles.itemName} numberOfLines={1}>
            {line?.name ?? "Order items"}
            {line?.variant ? ` · ${line.variant}` : ""}
          </Text>
          <Text style={styles.orderMeta} numberOfLines={1}>
            {metaBits.join(" · ") || "—"}
          </Text>
          <View style={styles.orderFooter}>
            <Text style={styles.orderTotal}>{orderMoney(item)}</Text>
            <Text style={[styles.orderPayment, codUnpaid && styles.orderPaymentWarn]}>
              {method} · {payStatus}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerScreenHeader kicker="Fulfillment" title="Orders" meta={headerCount} />

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search order, customer, city…"
          accessibilityLabel="Search orders"
        />
      </View>

      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item: tab }) => (
            <SellerFilterTab
              label={tab.label}
              count={counts[tab.key] ?? 0}
              active={statusTab === tab.key}
              onPress={() => setStatusTab(tab.key)}
            />
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {loading && orders.length === 0 ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
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
              style={{ marginTop: 24 }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: spacing[3], marginTop: spacing[1] },
  tabsContainer: { marginBottom: 8 },
  tabsContent: { paddingHorizontal: spacing[5], gap: 8 },
  listContent: { paddingHorizontal: spacing[5], paddingTop: 8 },
  orderCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    padding: 14,
    marginBottom: 10,
  },
  orderCardUnpaid: {
    borderColor: "rgba(184,92,58,0.35)",
    backgroundColor: "rgba(184,92,58,0.04)",
  },
  thumbWrap: { width: 58, height: 58 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
  },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  thumbBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: INK,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: CREAM,
  },
  thumbBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: CREAM,
  },
  orderBody: { flex: 1, minWidth: 0 },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  orderNumber: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  itemName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
    marginTop: 5,
  },
  orderMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 3,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sellerBorder,
    gap: 8,
  },
  orderTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
    letterSpacing: -0.3,
  },
  orderPayment: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
    flexShrink: 1,
    textAlign: "right",
  },
  orderPaymentWarn: { color: RUST, fontFamily: fontFamilies.sans.semibold },
  skelCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    padding: 14,
  },
});
