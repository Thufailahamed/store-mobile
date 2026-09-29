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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { getOrders } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

type Tab = "all" | "active" | "shipped" | "delivered" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_TONE: Record<
  OrderStatus,
  {
    label: string;
    bg: string;
    fg: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  pending: {
    label: "Awaiting confirmation",
    bg: "rgba(232, 169, 56, 0.12)",
    fg: "#9a6700",
    border: "rgba(232, 169, 56, 0.3)",
    icon: "time-outline",
  },
  confirmed: {
    label: "Confirmed",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: colors.olive[800],
    border: "rgba(83, 94, 44, 0.25)",
    icon: "checkmark-circle-outline",
  },
  processing: {
    label: "Preparing",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: colors.olive[800],
    border: "rgba(83, 94, 44, 0.25)",
    icon: "cube-outline",
  },
  shipped: {
    label: "In transit",
    bg: "rgba(59, 130, 246, 0.1)",
    fg: "#1d4ed8",
    border: "rgba(59, 130, 246, 0.25)",
    icon: "airplane-outline",
  },
  out_for_delivery: {
    label: "Out for delivery",
    bg: "rgba(16, 185, 129, 0.12)",
    fg: "#047857",
    border: "rgba(16, 185, 129, 0.3)",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "Delivered",
    bg: "rgba(16, 185, 129, 0.12)",
    fg: "#047857",
    border: "rgba(16, 185, 129, 0.3)",
    icon: "sparkles-outline",
  },
  cancelled: {
    label: "Cancelled",
    bg: "rgba(192, 57, 43, 0.08)",
    fg: colors.light.destructive,
    border: "rgba(192, 57, 43, 0.2)",
    icon: "close-circle-outline",
  },
  returned: {
    label: "Returned",
    bg: "rgba(200, 164, 74, 0.12)",
    fg: "#8a6d1a",
    border: "rgba(200, 164, 74, 0.25)",
    icon: "return-down-back-outline",
  },
  refunded: {
    label: "Refund processed",
    bg: "rgba(200, 164, 74, 0.12)",
    fg: "#8a6d1a",
    border: "rgba(200, 164, 74, 0.25)",
    icon: "cash-outline",
  },
  failed_attempt: {
    label: "Delivery rescheduled",
    bg: "rgba(220, 38, 38, 0.1)",
    fg: "#b91c1c",
    border: "rgba(220, 38, 38, 0.25)",
    icon: "alert-circle-outline",
  },
};

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "processing"];
const TRACKABLE: OrderStatus[] = ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"];

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function paymentLabel(method?: string) {
  if (!method) return "Card";
  if (method === "cod") return "Cash on Delivery";
  if (method === "paymentslk") return "Online Card Payment";
  return method.replace(/_/g, " ");
}

export default function OrdersScreen() {
  const router = useRouter();
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

  const counts = useMemo(
    () => ({
      all: orders.length,
      active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      shipped: orders.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter(
        (o) => o.status === "cancelled" || o.status === "returned" || o.status === "refunded",
      ).length,
    }),
    [orders],
  );

  const lifetimeSpend = useMemo(
    () => orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.total ?? 0 : 0), 0),
    [orders],
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (tab === "active") list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
    else if (tab === "shipped") list = list.filter((o) => o.status === "shipped" || o.status === "out_for_delivery");
    else if (tab === "delivered") list = list.filter((o) => o.status === "delivered");
    else if (tab === "cancelled") {
      list = list.filter((o) => o.status === "cancelled" || o.status === "returned" || o.status === "refunded");
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.items?.some((i) => i.product_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, tab, query]);

  if (loading) {
    return (
      <PaperBackground style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={["top"]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
            </TouchableOpacity>
            <View style={styles.topBarCenter}>
              <Text style={styles.topBarKicker}>ACCOUNT</Text>
              <Text style={styles.topBarTitle}>My orders</Text>
            </View>
            <View style={styles.navBtnPlaceholder} />
          </View>
          <View style={styles.loading}>
            <Skeleton height={140} borderRadius={radii["2xl"]} style={{ marginBottom: 12 }} />
            <Skeleton height={88} borderRadius={radii.xl} style={{ marginBottom: 16 }} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={160} borderRadius={radii["2xl"]} style={{ marginTop: 12 }} />
            ))}
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarKicker}>ACCOUNT</Text>
            <Text style={styles.topBarTitle}>My orders</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => loadOrders(true)}
            activeOpacity={0.7}
            accessibilityLabel="Refresh"
          >
            <Ionicons name="refresh-outline" size={18} color={colors.olive[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadOrders(true)}
              tintColor={colors.olive[700]}
            />
          }
        >
          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.summaryLabel}>Total spent</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatPrice(lifetimeSpend)}
                </Text>
                <Text style={styles.summarySub}>
                  across {counts.all} order{counts.all === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={styles.summaryIcon}>
                <Ionicons name="bag-handle-outline" size={18} color="#E8CF8F" />
              </View>
            </View>
            <View style={styles.summaryStats}>
              {([
                { key: "active", label: "In progress", value: counts.active, dot: "#E8A938" },
                { key: "shipped", label: "On the way", value: counts.shipped, dot: "#7FB3E8" },
                { key: "delivered", label: "Delivered", value: counts.delivered, dot: "#7ACF9E" },
              ] as const).map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.summaryStat, tab === m.key && styles.summaryStatActive]}
                  onPress={() => setTab(tab === m.key ? "all" : m.key)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === m.key }}
                  accessibilityLabel={`${m.value} ${m.label}`}
                >
                  <Text style={styles.summaryStatValue}>{m.value}</Text>
                  <View style={styles.summaryStatLabelRow}>
                    <View style={[styles.summaryDot, { backgroundColor: m.dot }]} />
                    <Text style={styles.summaryStatLabel} numberOfLines={1}>{m.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search-outline" size={17} color={colors.olive[700]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search orders, items, or numbers…"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Status Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
            style={styles.tabsScroll}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = counts[t.key];
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                  {count > 0 && (
                    <View style={[styles.tabCount, active && styles.tabCountActive]}>
                      <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Orders List */}
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bag-outline" size={30} color={colors.olive[700]} />
              </View>
              <Text style={styles.emptyTitle}>No acquisitions found</Text>
              <Text style={styles.emptySub}>
                {orders.length === 0
                  ? "Your order history will appear here once you place your first purchase."
                  : "Try adjusting your filters or search keywords."}
              </Text>
              {orders.length === 0 && (
                <TouchableOpacity
                  style={styles.shopNowBtn}
                  onPress={() => router.push("/(main)/products" as never)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shopNowBtnText}>Browse collection</Text>
                  <Ionicons name="arrow-forward" size={14} color="#faf8f1" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.ordersList}>
              {filtered.map((o) => (
                <LuxuryOrderCard key={o.id} order={o} router={router} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function LuxuryOrderCard({ order: o, router }: { order: Order; router: ReturnType<typeof useRouter> }) {
  const tone = STATUS_TONE[o.status] || STATUS_TONE.pending;
  const items = o.items ?? [];
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const firstItem = items[0];
  const firstImg =
    firstItem?.product?.images?.find((i) => i.is_primary)?.url ?? firstItem?.product?.images?.[0]?.url;
  const moreCount = items.length - 1;
  const canTrack = TRACKABLE.includes(o.status);

  const brand = firstItem?.product?.brand?.name || firstItem?.product?.store?.name || null;

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.94 }]}
      onPress={() => router.push(`/(main)/account/orders/${o.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${o.order_number}, ${tone.label}, ${formatPrice(o.total, o.currency)}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={12} color={tone.fg} />
          <Text style={[styles.statusBadgeText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
        <Text style={styles.orderDateText}>{formatRelative(o.placed_at)}</Text>
      </View>

      {firstItem ? (
        <View style={styles.itemRow}>
          <View style={styles.itemThumbWrap}>
            {firstImg ? (
              <Image source={{ uri: firstImg }} style={styles.itemThumbImage} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.itemThumbPlaceholder}>
                <Ionicons name="shirt-outline" size={22} color={colors.light.mutedForeground} />
              </View>
            )}
            {moreCount > 0 ? (
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyBadgeText}>+{moreCount}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.itemMetaColumn}>
            {brand ? (
              <Text style={styles.itemBrandName} numberOfLines={1}>{brand}</Text>
            ) : null}
            <Text style={styles.itemTitleName} numberOfLines={2}>
              {firstItem.product_name}
            </Text>
            <Text style={styles.itemVariantText} numberOfLines={1}>
              {[firstItem.variant_label, `${itemCount} item${itemCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
            </Text>
          </View>

          <Text style={styles.orderPriceText}>{formatPrice(o.total, o.currency)}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.orderNumberText} numberOfLines={1}>
          #{o.order_number} · {paymentLabel(o.payment_method)}
        </Text>
        {canTrack ? (
          <TouchableOpacity
            style={styles.trackLogisticsBtn}
            onPress={() => router.push(`/(main)/account/orders/${o.id}/track` as never)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Track order ${o.order_number}`}
          >
            <Ionicons name="navigate-outline" size={12} color={colors.olive[800]} />
            <Text style={styles.trackLogisticsBtnText}>Track</Text>
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={15} color={colors.light.mutedForeground} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { padding: spacing[5], paddingTop: spacing[2] },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
  },

  /* Top Navigation Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
    backgroundColor: "#f8f7f2",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  topBarCenter: {
    alignItems: "center",
    gap: 1,
  },
  topBarKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },

  /* Summary */
  summaryCard: {
    backgroundColor: colors.olive[950],
    borderRadius: 24,
    padding: 18,
    marginBottom: spacing[4],
  },
  summaryTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  summaryLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.6)",
  },
  summaryValue: {
    marginTop: 4,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 40,
    color: "#FAF8F1",
    fontVariant: ["tabular-nums"],
  },
  summarySub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryStats: { flexDirection: "row", gap: 8, marginTop: 16 },
  summaryStat: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(250,248,241,0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  summaryStatActive: { borderColor: "rgba(232,207,143,0.6)", backgroundColor: "rgba(250,248,241,0.1)" },
  summaryStatValue: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: "#FAF8F1", fontVariant: ["tabular-nums"] },
  summaryStatLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  summaryDot: { width: 6, height: 6, borderRadius: 3 },
  summaryStatLabel: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "rgba(250,248,241,0.65)" },

  /* Search Bar */
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.light.foreground,
    padding: 0,
  },

  /* Filter Tabs */
  tabsScroll: {
    marginHorizontal: -spacing[5],
    marginBottom: spacing[4],
  },
  tabsRow: {
    paddingHorizontal: spacing[5],
    gap: 8,
    flexDirection: "row",
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
  },
  tabChipActive: {
    backgroundColor: "#2c3119",
    borderColor: "#2c3119",
    ...shadows.soft,
  },
  tabLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  tabLabelActive: {
    color: "#faf8f1",
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabCountActive: {
    backgroundColor: "rgba(200, 164, 74, 0.3)",
  },
  tabCountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: colors.olive[800],
  },
  tabCountTextActive: {
    color: "#E8CF8F",
  },

  /* Empty State */
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: spacing[2],
    ...shadows.soft,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  shopNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[700],
    borderRadius: radii.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...shadows.soft,
  },
  shopNowBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#faf8f1",
  },

  /* Order Cards */
  ordersList: { gap: 12 },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    padding: 14,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
  orderDateText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemThumbWrap: { width: 64, height: 64, borderRadius: 14, overflow: "visible" },
  itemThumbImage: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#f0ede2" },
  itemThumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
  },
  itemQtyBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.olive[900],
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  itemQtyBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: "#FAF8F1" },
  itemMetaColumn: { flex: 1, minWidth: 0, gap: 2 },
  itemBrandName: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  itemTitleName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, lineHeight: 19, color: colors.light.foreground },
  moreItemsText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  itemVariantText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  orderPriceText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
    fontVariant: ["tabular-nums"],
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.1)",
  },
  orderNumberText: {
    flex: 1,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  trackLogisticsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  trackLogisticsBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
});
