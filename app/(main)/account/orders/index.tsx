import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { getOrders } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
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
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";


type Tab = "all" | "transit" | "process" | "delivered" | "closed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "transit", label: "Transit" },
  { key: "process", label: "On Process" },
  { key: "delivered", label: "Delivered" },
  { key: "closed", label: "Cancelled" },
];


function inTab(status: OrderStatus, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "transit") return TRANSIT.includes(status);
  if (tab === "process") return PROCESS.includes(status);
  if (tab === "delivered") return status === "delivered";
  return CLOSED.includes(status);
}


export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await getOrders(user.id, 50);
    if (res.ok) setOrders(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const counts = useMemo(() => {
    const c = { all: 0, transit: 0, process: 0, delivered: 0, closed: 0 } as Record<Tab, number>;
    for (const o of orders) {
      for (const t of TABS) if (inTab(o.status, t.key)) c[t.key] += 1;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders.filter((o) => inTab(o.status, tab));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.items?.some(
            (i) =>
              i.product_name.toLowerCase().includes(q) ||
              (i.store?.name ?? "").toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [orders, tab, query]);

  const visibleTabs = TABS.filter((t) => t.key !== "closed" || counts.closed > 0);

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.headerGlow}
      />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">My Orders</Text>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.push("/(main)/account/returns" as never)}
            activeOpacity={0.8}
            accessibilityLabel="Returns and refunds"
          >
            <Ionicons name="return-up-back-outline" size={19} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor={C.accent} />
          }
        >
          <View style={styles.search}>
            <Ionicons name="search-outline" size={20} color={C.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your parcel"
              placeholderTextColor="#A1A1A6"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={C.faint} />
              </TouchableOpacity>
            )}
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

          {loading ? (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={232} borderRadius={26} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              hasOrders={orders.length > 0}
              onShop={() => router.push("/(main)/products" as never)}
            />
          ) : (
            <View style={styles.list}>
              {filtered.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 6) * 70).duration(420)}>
                  <ParcelCard
                    order={o}
                    onPress={() => router.push(`/(main)/account/orders/${o.id}` as never)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ParcelCard({ order: o, onPress }: { order: Order; onPress: () => void }) {
  const items = o.items ?? [];
  const first = items[0];
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const thumb =
    first?.image_url ??
    first?.product?.images?.find((i) => i.is_primary)?.url ??
    first?.product?.images?.[0]?.url ??
    null;
  const ribbon = RIBBON[o.status] ?? RIBBON.pending;

  const stores = Array.from(new Set(items.map((i) => i.store?.name).filter((n): n is string => !!n)));
  const from = stores.length === 0 ? "LUXE" : stores.length === 1 ? stores[0] : `${stores[0]} +${stores.length - 1}`;
  const ship = o.shipping_address ?? o.address;
  const to = ship ? [ship.city, ship.state].filter(Boolean).join(", ") || ship.line1 : "Your address";

  let toSub: string;
  if (o.status === "delivered") toSub = `Delivered ${shortDate(o.delivered_at ?? o.placed_at)}`;
  else if (o.status === "cancelled") toSub = "Order cancelled";
  else if (o.status === "returned") toSub = "Returned";
  else if (o.status === "refunded") toSub = "Refunded";
  else toSub = `Estimated ${shortDate(etaFor(o).eta)}`;

  const more = items.length - 1;

  return (
    <View style={styles.cardShadow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Order ${o.order_number}, ${ribbon.label.toLowerCase()}, ${formatPrice(o.total, o.currency)}`}
      >
        <ParcelArt />

        <View pointerEvents="none" style={styles.ribbonClip}>
          <View style={[styles.ribbon, { backgroundColor: ribbon.bg }]}>
            <Text style={[styles.ribbonText, { color: ribbon.fg }]} numberOfLines={1}>{ribbon.label}</Text>
          </View>
        </View>

        <View style={styles.cardHead}>
          <View style={styles.thumb}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbImg} contentFit="cover" transition={200} />
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
              ID: {o.order_number}
            </Text>
            <Text style={styles.productName} numberOfLines={1}>
              {first?.product_name ?? "Order"}
            </Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              {formatPrice(o.total, o.currency)} · {itemCount} item{itemCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <TrackRail order={o} />

        <View style={routeStyles.route}>
          <View style={routeStyles.routeCol}>
            <Text style={routeStyles.routeLabel}>FROM</Text>
            <Text style={routeStyles.routeValue} numberOfLines={1}>{from}</Text>
            <Text style={routeStyles.routeSub} numberOfLines={1}>{shortDate(o.placed_at)}</Text>
          </View>
          <View style={routeStyles.routeCol}>
            <Text style={routeStyles.routeLabel}>TO</Text>
            <Text style={routeStyles.routeValue} numberOfLines={1}>{to}</Text>
            <Text style={routeStyles.routeSub} numberOfLines={1}>{toSub}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function EmptyState({ hasOrders, onShop }: { hasOrders: boolean; onShop: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <MaterialCommunityIcons name="package-variant" size={34} color={C.accent} />
      </View>
      <Text style={styles.emptyTitle}>{hasOrders ? "No parcels here" : "No orders yet"}</Text>
      <Text style={styles.emptySub}>
        {hasOrders
          ? "Try another filter or search for a different order number."
          : "When you place an order, you can follow every step of its journey here."}
      </Text>
      {!hasOrders && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onShop} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>Start shopping</Text>
          <Ionicons name="arrow-forward" size={15} color={C.lime} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
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

  content: { paddingHorizontal: 20, paddingTop: 4 },

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

  chipsScroll: { marginHorizontal: -20, marginTop: 18, marginBottom: 18 },
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

  list: { gap: 16 },

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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  cardPressed: { transform: [{ scale: 0.985 }] },

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

  route: { flexDirection: "row", gap: 14, marginTop: 18, paddingRight: 62 },
  routeCol: { flex: 1, minWidth: 0 },
  routeLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.muted,
  },
  routeValue: {
    marginTop: 4,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: C.text,
  },
  routeSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },


  empty: {
    alignItems: "center",
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
