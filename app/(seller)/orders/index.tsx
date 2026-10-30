import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  StatusBar,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerOrders, transitionOrderStatus, cancelOrder } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  C,
  CLOSED,
  PROCESS,
  RIBBON,
  TRANSIT,
  ParcelArt,
  TrackRail,
  etaFor,
  routeStyles,
  shortDate,
} from "@/components/orders/parcel-track";
import {
  countOrderUnits,
  filterSellerOrders,
  firstLineItem,
  formatOrderStatusLabel,
  formatPaymentStatus,
  readShippingContact,
} from "@/lib/orders/seller-list";
import { formatPrice } from "@/lib/utils";
import { canSellerCancelOrder, getSellerAdvanceStatus } from "@/lib/order-lifecycle";
import type { Order, OrderStatus } from "@/lib/types";

type Tab = "all" | "new" | "process" | "transit" | "delivered" | "closed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "process", label: "On Process" },
  { key: "transit", label: "Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "closed", label: "Cancelled" },
];

function inTab(status: OrderStatus, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "new") return status === "pending";
  if (tab === "process") return PROCESS.includes(status) && status !== "pending";
  if (tab === "transit") return TRANSIT.includes(status);
  if (tab === "delivered") return status === "delivered";
  return CLOSED.includes(status);
}

function orderMoney(order: Order): string {
  if (!Number.isFinite(order.total)) return "—";
  return formatPrice(order.total, order.currency || "LKR");
}

export default function SellerOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string }>();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const incomingSearch = typeof params.search === "string" ? params.search : "";
  const [searchInput, setSearchInput] = useState(incomingSearch);
  const [search, setSearch] = useState(incomingSearch);
  const [tab, setTab] = useState<Tab>("all");
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
        setLoading(false);
        setRefreshing(false);
        return;
      }
      sid = storeRes.data.id;
      setStoreId(sid);
      setStoreName(storeRes.data.name ?? null);
    }
    const res = await getSellerOrders(sid, { limit: 200 });
    if (res.ok) {
      setOrders(res.data.orders);
      setLoadError(null);
    } else {
      setLoadError(res.error);
      setOrders([]);
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
    const next = getSellerAdvanceStatus(order.status);
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

  const searched = useMemo(() => filterSellerOrders(orders, { status: "all", search }), [orders, search]);

  const counts = useMemo(() => {
    const c = { all: 0, new: 0, process: 0, transit: 0, delivered: 0, closed: 0 } as Record<Tab, number>;
    for (const o of searched) {
      for (const t of TABS) if (inTab(o.status, t.key)) c[t.key] += 1;
    }
    return c;
  }, [searched]);

  const visible = useMemo(() => searched.filter((o) => inTab(o.status, tab)), [searched, tab]);
  const visibleTabs = TABS.filter((t) => t.key !== "closed" || counts.closed > 0 || tab === "closed");

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        {router.canGoBack() ? (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} accessibilityRole="header">Orders</Text>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.push("/(seller)/returns" as never)}
          activeOpacity={0.8}
          accessibilityLabel="Returns"
        >
          <Ionicons name="return-up-back-outline" size={19} color={C.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order, customer, city"
            placeholderTextColor="#A1A1A6"
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            accessibilityLabel="Search orders"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={C.faint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {visibleTabs.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
              <View style={[styles.chipCount, on && styles.chipCountOn]}>
                <Text style={[styles.chipCountText, on && styles.chipCountTextOn]}>{counts[t.key]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.headerGlow}
      />
      {loading && orders.length === 0 ? (
        <>
          {listHeader}
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={232} borderRadius={26} />
            ))}
          </View>
        </>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View
              style={styles.cardRow}
              entering={FadeInDown.delay(Math.min(index, 6) * 70).duration(420)}
            >
              <SellerParcelCard
                order={item}
                storeName={storeName}
                busy={updatingId === item.id}
                onPress={() => router.push(`/(seller)/orders/${item.id}` as const)}
                onAdvance={() => void handleAdvance(item)}
                onCancel={() => void handleCancel(item)}
              />
            </Animated.View>
          )}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          ListEmptyComponent={
            <EmptyState
              error={loadError}
              hasOrders={orders.length > 0}
              onRetry={() => void fetchOrders()}
            />
          }
        />
      )}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

function SellerParcelCard({
  order: o,
  storeName,
  busy,
  onPress,
  onAdvance,
  onCancel,
}: {
  order: Order;
  storeName: string | null;
  busy: boolean;
  onPress: () => void;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const line = firstLineItem(o.items);
  const units = countOrderUnits(o.items) ?? 0;
  const more = (o.items?.length ?? 0) - 1;
  const ship = readShippingContact(o);
  const ribbon = RIBBON[o.status] ?? RIBBON.pending;
  const nextStatus = getSellerAdvanceStatus(o.status);
  const canCancel = canSellerCancelOrder(o.status);
  const codUnpaid = o.payment_method === "cod" && o.payment_status !== "paid";
  const customer = ship.name?.trim() || "Customer";

  let toSub: string;
  if (o.status === "delivered") toSub = `Delivered ${shortDate(o.delivered_at ?? o.placed_at)}`;
  else if (o.status === "cancelled") toSub = "Order cancelled";
  else if (o.status === "returned") toSub = "Returned";
  else if (o.status === "refunded") toSub = "Refunded";
  else toSub = `Estimated ${shortDate(etaFor(o).eta)}`;

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Order ${o.order_number}, ${formatOrderStatusLabel(o.status)}, ${orderMoney(o)}`}
        >
          <ParcelArt />

          <View style={styles.cardHead}>
            <View style={styles.thumb}>
              {line?.imageUrl ? (
                <Image source={{ uri: line.imageUrl }} style={styles.thumbImg} contentFit="cover" transition={200} />
              ) : (
                <Ionicons name="shirt-outline" size={24} color={C.muted} />
              )}
              {more > 0 ? (
                <View style={styles.moreBadge}>
                  <Text style={styles.moreBadgeText}>+{more}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.headText}>
              <Text style={styles.orderId} numberOfLines={1}>
                ID: {o.order_number || "—"}
              </Text>
              <Text style={styles.productName} numberOfLines={1}>
                {line?.name ?? "Order"}{line?.variant ? ` · ${line.variant}` : ""}
              </Text>
              <Text style={styles.metaLine} numberOfLines={1}>
                {orderMoney(o)} · {units} item{units === 1 ? "" : "s"} · {customer}
              </Text>
            </View>
          </View>

          <TrackRail order={o} />

          <View style={routeStyles.route}>
            <View style={routeStyles.routeCol}>
              <Text style={routeStyles.routeLabel}>FROM</Text>
              <Text style={routeStyles.routeValue} numberOfLines={1}>{storeName || "Your store"}</Text>
              <Text style={routeStyles.routeSub} numberOfLines={1}>{shortDate(o.placed_at)}</Text>
            </View>
            <View style={routeStyles.routeCol}>
              <Text style={routeStyles.routeLabel}>TO</Text>
              <Text style={routeStyles.routeValue} numberOfLines={1}>{ship.place || customer}</Text>
              <Text style={routeStyles.routeSub} numberOfLines={1}>{toSub}</Text>
            </View>
          </View>
        </Pressable>

        <View pointerEvents="none" style={styles.ribbonClip}>
          <View style={[styles.ribbon, { backgroundColor: ribbon.bg }]}>
            <Text style={[styles.ribbonText, { color: ribbon.fg }]} numberOfLines={1}>{ribbon.label}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={[styles.payPill, codUnpaid && styles.payPillWarn]}>
            <Ionicons
              name={codUnpaid ? "alert-circle-outline" : "checkmark-circle"}
              size={13}
              color={codUnpaid ? C.rust : C.accent}
            />
            <Text style={[styles.payText, codUnpaid && styles.payTextWarn]} numberOfLines={1}>
              {formatPaymentStatus(o.payment_status)}
            </Text>
          </View>
          <View style={styles.actions}>
            {canCancel ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${o.order_number}`}
                hitSlop={6}
              >
                <Ionicons name="close" size={17} color={C.rust} />
              </TouchableOpacity>
            ) : null}
            {nextStatus ? (
              <TouchableOpacity
                style={[styles.advanceBtn, busy && styles.advanceBtnBusy]}
                onPress={onAdvance}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
              >
                <Text style={styles.advanceText} numberOfLines={1}>
                  {busy ? "Working…" : `Mark ${formatOrderStatusLabel(nextStatus).toLowerCase()}`}
                </Text>
                {busy ? null : <Ionicons name="arrow-forward" size={14} color={C.lime} />}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ error, hasOrders, onRetry }: { error: string | null; hasOrders: boolean; onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <MaterialCommunityIcons
          name={error ? "cloud-off-outline" : "package-variant"}
          size={34}
          color={error ? C.rust : C.accent}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {error ? "Couldn’t load orders" : hasOrders ? "No parcels here" : "No orders yet"}
      </Text>
      <Text style={styles.emptySub}>
        {error ??
          (hasOrders
            ? "Try another filter or search for a different order."
            : "Orders from your store will appear here, ready to pack and ship.")}
      </Text>
      {error ? (
        <TouchableOpacity style={styles.emptyBtn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>Try again</Text>
          <Ionicons name="refresh" size={15} color={C.lime} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#ebe5cc" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },

  searchWrap: { paddingHorizontal: 20, paddingTop: 4 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
    padding: 0,
  },

  chipsScroll: { flexGrow: 0, marginTop: 18, marginBottom: 18 },
  chipsRow: { paddingHorizontal: 20, gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  chipTextOn: { color: C.cream },
  chipCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  chipCountOn: { backgroundColor: "rgba(200,224,138,0.18)" },
  chipCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: C.muted },
  chipCountTextOn: { color: C.lime },

  list: { gap: 16, paddingHorizontal: 20 },
  cardRow: { paddingHorizontal: 20, marginBottom: 16 },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: C.card,
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  card: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardMain: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, overflow: "hidden" },
  cardPressed: { opacity: 0.92 },

  ribbonClip: { position: "absolute", top: 0, right: 0, width: 116, height: 116, overflow: "hidden" },
  ribbon: {
    position: "absolute",
    top: 24,
    right: -44,
    width: 170,
    paddingVertical: 6,
    alignItems: "center",
    transform: [{ rotate: "35deg" }],
  },
  ribbonText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.6,
  },

  cardHead: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 64 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: { width: 60, height: 60, borderRadius: 18 },
  moreBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: C.cream },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  orderId: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, letterSpacing: -0.3, color: C.text },
  productName: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: C.muted },
  metaLine: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted, marginTop: 1 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
  },
  payPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.accentSoft,
  },
  payPillWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  payText: { flexShrink: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },
  payTextWarn: { color: C.rust },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.25)",
  },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.ink,
  },
  advanceBtnBusy: { opacity: 0.6 },
  advanceText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.cream },

  empty: {
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  emptyArt: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  emptyBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },
});
