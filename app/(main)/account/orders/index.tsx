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
import Svg, { Path } from "react-native-svg";
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
    label: "Pending confirmation",
    bg: "rgba(232, 169, 56, 0.12)",
    fg: "#9a6700",
    border: "rgba(232, 169, 56, 0.3)",
    icon: "time-outline",
  },
  confirmed: {
    label: "Confirmed at Atelier",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: colors.olive[800],
    border: "rgba(83, 94, 44, 0.25)",
    icon: "checkmark-circle-outline",
  },
  processing: {
    label: "Preparing in Atelier",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: colors.olive[800],
    border: "rgba(83, 94, 44, 0.25)",
    icon: "cube-outline",
  },
  shipped: {
    label: "Dispatched · In transit",
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
    label: "Safely delivered",
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
  if (method === "payhere") return "Online Card Payment";
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
              <Text style={styles.topBarKicker}>ACQUISITIONS</Text>
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
            <Text style={styles.topBarKicker}>ACQUISITIONS</Text>
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
          {/* Haute Horlogerie Order Archive Hero Card */}
          <View style={styles.heroCard}>
            <LinearGradient
              colors={["#181b12", "#273019", "#13160e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              {/* Guilloche Wave Engravings */}
              <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Path
                  d="M-30 20 C 70 80, 180 15, 270 70 S 370 25, 450 65"
                  fill="none"
                  stroke="rgba(200, 164, 74, 0.08)"
                  strokeWidth={1.2}
                />
                <Path
                  d="M-30 35 C 70 95, 180 30, 270 85 S 370 40, 450 80"
                  fill="none"
                  stroke="rgba(200, 164, 74, 0.08)"
                  strokeWidth={1.2}
                />
              </Svg>

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadgePill}>
                  <Ionicons name="sparkles" size={10} color="#E8CF8F" />
                  <Text style={styles.heroBadgeText}>ATELIER ARCHIVE</Text>
                </View>
                <View style={styles.heroSeal}>
                  <Ionicons name="receipt-outline" size={18} color="#E8CF8F" />
                </View>
              </View>

              <View style={styles.heroCopyBlock}>
                <Text style={styles.heroTitle}>Threads, tracked</Text>
                <Text style={styles.heroSub}>
                  Real-time parcel logistics, authentication & delivery timeline
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Unified Haute Horlogerie Metric Bar */}
          <View style={styles.metricsCard}>
            <View style={styles.metricItem}>
              <View style={styles.metricIconBox}>
                <Ionicons name="layers-outline" size={14} color={colors.olive[700]} />
              </View>
              <Text style={styles.metricValue}>{counts.all}</Text>
              <Text style={styles.metricLabel}>LIFETIME</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={[styles.metricIconBox, styles.metricIconAccent]}>
                <Ionicons name="pulse-outline" size={14} color="#85651b" />
              </View>
              <Text style={[styles.metricValue, { color: "#85651b" }]}>{counts.active}</Text>
              <Text style={styles.metricLabel}>ACTIVE</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={styles.metricIconBox}>
                <Ionicons name="checkmark-done-outline" size={14} color="#047857" />
              </View>
              <Text style={[styles.metricValue, { color: "#047857" }]}>{counts.delivered}</Text>
              <Text style={styles.metricLabel}>DELIVERED</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={[styles.metricItem, { flex: 1.2 }]}>
              <View style={styles.metricIconBox}>
                <Ionicons name="wallet-outline" size={14} color={colors.olive[700]} />
              </View>
              <Text style={styles.metricValueMono} numberOfLines={1}>
                {formatPrice(lifetimeSpend)}
              </Text>
              <Text style={styles.metricLabel}>SPENT</Text>
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

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.94 }]}
      onPress={() => router.push(`/(main)/account/orders/${o.id}` as never)}
    >
      {/* Card Header: Meta & Status */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.orderKickerRow}>
            <Text style={styles.orderKickerText}>ACQUISITION</Text>
            <View style={styles.metaDot} />
            <Text style={styles.orderDateText}>{formatRelative(o.placed_at)}</Text>
          </View>
          <Text style={styles.orderNumberText}>#{o.order_number}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Ionicons name={tone.icon} size={12} color={tone.fg} />
          <Text style={[styles.statusBadgeText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>

      {/* Main Items Showcase */}
      {firstItem && (
        <View style={styles.itemShowcaseBox}>
          <View style={styles.itemThumbWrap}>
            {firstImg ? (
              <Image source={{ uri: firstImg }} style={styles.itemThumbImage} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.itemThumbPlaceholder}>
                <Ionicons name="shirt-outline" size={22} color={colors.light.mutedForeground} />
              </View>
            )}
            {itemCount > 1 && (
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyBadgeText}>{itemCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.itemMetaColumn}>
            <Text style={styles.itemBrandName} numberOfLines={1}>
              {firstItem.product?.brand?.name || firstItem.product?.store?.name || "LUXE CURATED"}
            </Text>
            <Text style={styles.itemTitleName} numberOfLines={1}>
              {firstItem.product_name}
            </Text>

            <View style={styles.itemVariantRow}>
              {firstItem.variant_label ? (
                <View style={styles.variantChip}>
                  <Text style={styles.variantChipText}>{firstItem.variant_label}</Text>
                </View>
              ) : null}
              {moreCount > 0 && (
                <Text style={styles.moreItemsText}>
                  +{moreCount} more piece{moreCount === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.priceColumn}>
            <Text style={styles.orderPriceText}>{formatPrice(o.total, o.currency)}</Text>
            <Text style={styles.orderQtySub}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      )}

      {/* Card Logistics & Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.paymentMethodPill}>
          <Ionicons
            name={o.payment_method === "cod" ? "cash-outline" : "card-outline"}
            size={12}
            color={colors.olive[700]}
          />
          <Text style={styles.paymentMethodText}>{paymentLabel(o.payment_method)}</Text>
        </View>

        <View style={styles.cardActionsRow}>
          {canTrack && (
            <TouchableOpacity
              style={styles.trackLogisticsBtn}
              onPress={() => router.push(`/(main)/account/orders/${o.id}/track` as never)}
              activeOpacity={0.8}
            >
              <Ionicons name="paper-plane-outline" size={12} color={colors.olive[800]} />
              <Text style={styles.trackLogisticsBtnText}>Track parcel</Text>
            </TouchableOpacity>
          )}
          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
          </View>
        </View>
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

  /* Hero Card */
  heroCard: {
    borderRadius: radii["2xl"],
    overflow: "hidden",
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.soft,
  },
  heroGradient: {
    padding: spacing[5],
    position: "relative",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  heroBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  heroBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: "#E8CF8F",
    textTransform: "uppercase",
  },
  heroSeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroCopyBlock: {
    gap: 3,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250, 248, 241, 0.75)",
    lineHeight: 17,
  },

  /* Metrics Card */
  metricsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metricIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  metricIconAccent: {
    backgroundColor: "rgba(200, 164, 74, 0.15)",
  },
  metricValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  metricValueMono: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#ecebe4",
  },

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
  ordersList: {
    gap: spacing[3] + 2,
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: spacing[3],
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  cardHeaderLeft: {
    gap: 2,
  },
  orderKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderKickerText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#d1d5db",
  },
  orderDateText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  orderNumberText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },

  /* Items Showcase */
  itemShowcaseBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[2] + 2,
    backgroundColor: "#f9f8f4",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.05)",
  },
  itemThumbWrap: {
    width: 60,
    height: 72,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#eae7dd",
    position: "relative",
  },
  itemThumbImage: {
    width: "100%",
    height: "100%",
  },
  itemThumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemQtyBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2c3119",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  itemQtyBadgeText: {
    color: "#E8CF8F",
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },
  itemMetaColumn: {
    flex: 1,
    gap: 2,
  },
  itemBrandName: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  itemTitleName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  itemVariantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  variantChip: {
    backgroundColor: "#ffffff",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  variantChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 0.4,
  },
  moreItemsText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  priceColumn: {
    alignItems: "flex-end",
    gap: 2,
  },
  orderPriceText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  orderQtySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[1],
    borderTopWidth: 1,
    borderTopColor: "#f3f2eb",
  },
  paymentMethodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  paymentMethodText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  trackLogisticsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  trackLogisticsBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    color: colors.olive[800],
    letterSpacing: 0.3,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f5f4ef",
    alignItems: "center",
    justifyContent: "center",
  },
});
