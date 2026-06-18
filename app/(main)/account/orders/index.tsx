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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PaperBackground, ScreenHeader } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { getOrders } from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
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

const STATUS_TONE: Record<OrderStatus, { label: string; bg: string; fg: string; stripe: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: "Pending", bg: "#fef3c7", fg: "#92400e", stripe: colors.accent2.ochre, icon: "time-outline" },
  confirmed: { label: "Confirmed", bg: colors.olive[100], fg: colors.olive[700], stripe: colors.olive[500], icon: "checkmark-circle-outline" },
  processing: { label: "Processing", bg: colors.olive[100], fg: colors.olive[700], stripe: colors.olive[600], icon: "construct-outline" },
  shipped: { label: "Shipped", bg: "#dbeafe", fg: "#1e40af", stripe: "#3b82f6", icon: "airplane-outline" },
  out_for_delivery: { label: "On the way", bg: colors.olive[200], fg: colors.olive[800], stripe: colors.olive[700], icon: "bicycle-outline" },
  delivered: { label: "Delivered", bg: "#dcfce7", fg: "#166534", stripe: "#16a34a", icon: "gift-outline" },
  cancelled: { label: "Cancelled", bg: colors.light.destructive + "18", fg: colors.light.destructive, stripe: colors.light.destructive, icon: "close-circle-outline" },
  returned: { label: "Returned", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, stripe: colors.accent2.ochre, icon: "return-down-back-outline" },
  refunded: { label: "Refunded", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, stripe: colors.accent2.rust, icon: "cash-outline" },
  failed_attempt: { label: "Attempt failed", bg: "#fee2e2", fg: "#b91c1c", stripe: "#dc2626", icon: "alert-circle-outline" },
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
  if (!method) return "—";
  if (method === "cod") return "Cash on delivery";
  if (method === "payhere") return "Card";
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

  const counts = useMemo(() => ({
    all: orders.length,
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    shipped: orders.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "returned" || o.status === "refunded").length,
  }), [orders]);

  const lifetimeSpend = useMemo(
    () => orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? (o.total ?? 0) : 0), 0),
    [orders],
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (tab === "active") list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
    else if (tab === "shipped") list = list.filter((o) => o.status === "shipped" || o.status === "out_for_delivery");
    else if (tab === "delivered") list = list.filter((o) => o.status === "delivered");
    else if (tab === "cancelled") list = list.filter((o) => o.status === "cancelled" || o.status === "returned" || o.status === "refunded");

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
          <ScreenHeader title="My orders" />
          <View style={styles.loading}>
            <Skeleton height={140} borderRadius={radii["2xl"]} style={{ marginBottom: 12 }} />
            <View style={styles.loadingStats}>
              <Skeleton height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
              <Skeleton height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
            </View>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={148} borderRadius={radii["2xl"]} style={{ marginTop: 12 }} />
            ))}
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <ScreenHeader title="My orders" />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} tintColor={colors.light.primary} />
          }
        >
          <View style={styles.hero}>
            <LinearGradient
              colors={[colors.olive[600], colors.olive[800]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroInner}>
              <View style={styles.heroCopy}>
                <Label style={styles.heroLabel}>Purchase history</Label>
                <Display size="2xl" style={styles.heroTitle}>Threads, tracked</Display>
                <Body style={styles.heroSub}>Every parcel, refund, and review in one place.</Body>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="receipt-outline" size={22} color={colors.olive[700]} />
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Lifetime" value={String(counts.all)} icon="layers-outline" />
            <StatCard label="Active" value={String(counts.active)} icon="pulse-outline" accent />
            <StatCard label="Delivered" value={String(counts.delivered)} icon="checkmark-done-outline" />
            <StatCard label="Spent" value={formatPrice(lifetimeSpend)} icon="wallet-outline" compact />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search orders, items, or numbers"
              placeholderTextColor={colors.light.mutedForeground}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

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
                  <Label style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Label>
                  {count > 0 && (
                    <View style={[styles.tabCount, active && styles.tabCountActive]}>
                      <Label style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Label>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bag-outline" size={28} color={colors.olive[600]} />
              </View>
              <Display size="lg">No orders found</Display>
              <Body muted size="sm" style={{ textAlign: "center" }}>
                {orders.length === 0 ? "Start shopping to fill this page." : "Try a different filter or search."}
              </Body>
              {orders.length === 0 && (
                <TouchableOpacity style={styles.shopBtn} onPress={() => router.push("/(main)/products" as never)}>
                  <Label style={styles.shopBtnText}>Browse products</Label>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((o) => (
                <OrderCard key={o.id} order={o} router={router} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  compact,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={[styles.statIcon, accent && styles.statIconAccent]}>
        <Ionicons name={icon} size={15} color={accent ? colors.olive[700] : colors.light.primary} />
      </View>
      <Text numberOfLines={1} style={[styles.statValue, compact && styles.statValueCompact]}>
        {value}
      </Text>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

function OrderCard({ order: o, router }: { order: Order; router: ReturnType<typeof useRouter> }) {
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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      onPress={() => router.push(`/(main)/account/orders/${o.id}` as never)}
    >
      <View style={[styles.cardStripe, { backgroundColor: tone.stripe }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderMetaRow}>
              <Label style={styles.orderKicker}>Order</Label>
              <View style={styles.dot} />
              <Body muted size="xs">{formatRelative(o.placed_at)}</Body>
            </View>
            <Body size="sm" style={styles.orderNumber}>#{o.order_number}</Body>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={12} color={tone.fg} />
            <Label style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Label>
          </View>
        </View>

        {firstItem && (
          <View style={styles.itemRow}>
            <View style={styles.thumb}>
              {firstImg ? (
                <Image source={{ uri: firstImg }} style={styles.thumbImage} contentFit="cover" />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="cube-outline" size={20} color={colors.light.mutedForeground} />
                </View>
              )}
              {itemCount > 1 && (
                <View style={styles.itemCountBadge}>
                  <Label style={styles.itemCountText}>{itemCount}</Label>
                </View>
              )}
            </View>
            <View style={styles.itemInfo}>
              <Body size="sm" numberOfLines={2} style={styles.itemName}>{firstItem.product_name}</Body>
              {firstItem.variant_label ? (
                <Label style={styles.variantLabel}>{firstItem.variant_label}</Label>
              ) : null}
              {moreCount > 0 && (
                <Body muted size="xs">+{moreCount} more item{moreCount === 1 ? "" : "s"}</Body>
              )}
            </View>
            <Price size="sm" style={styles.linePrice}>{formatPrice(o.total, o.currency)}</Price>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.payPill}>
            <Ionicons name="card-outline" size={11} color={colors.light.mutedForeground} />
            <Label style={styles.payText}>{paymentLabel(o.payment_method)}</Label>
          </View>
          <View style={styles.cardActions}>
            {canTrack && (
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => router.push(`/(main)/account/orders/${o.id}/track` as never)}
              >
                <Ionicons name="navigate-outline" size={13} color={colors.olive[700]} />
                <Label style={styles.trackBtnText}>Track</Label>
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { padding: spacing[5], paddingTop: spacing[3] },
  loadingStats: { flexDirection: "row", gap: 10 },
  content: { padding: spacing[5], paddingBottom: spacing[10] },

  hero: {
    borderRadius: radii["2xl"],
    overflow: "hidden",
    marginBottom: spacing[4],
    ...shadows.editorial,
  },
  heroInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing[5],
    gap: spacing[3],
  },
  heroCopy: { flex: 1 },
  heroLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    marginTop: spacing[1],
    marginBottom: spacing[2],
    fontFamily: fontFamilies.display.semibold,
  },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: typography.fontSizes.sm },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing[4],
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  statCardAccent: {
    backgroundColor: colors.olive[50],
    borderColor: colors.olive[200],
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: 2,
  },
  statIconAccent: { backgroundColor: colors.light.card },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
  },
  statValueCompact: {
    fontSize: typography.fontSizes.lg,
    fontFamily: fontFamilies.mono.semibold,
  },
  statLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: 12,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    padding: 0,
  },

  tabsScroll: { marginHorizontal: -spacing[5], marginBottom: spacing[4] },
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
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  tabChipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabLabel: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tabLabelActive: { color: colors.light.primaryForeground },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabCountText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: colors.olive[700],
  },
  tabCountTextActive: { color: "#fff" },

  empty: {
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[700],
    borderRadius: radii.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: spacing[2],
  },
  shopBtnText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  list: { gap: spacing[3] },
  card: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardStripe: { width: 4 },
  cardBody: { flex: 1, padding: spacing[4], gap: spacing[3] },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  orderMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderKicker: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.light.border,
  },
  orderNumber: {
    fontFamily: fontFamilies.mono.semibold,
    color: colors.light.foreground,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  statusText: { fontSize: 10, fontFamily: fontFamilies.sans.semibold },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[2],
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  thumb: {
    width: 64,
    height: 76,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.light.muted,
    position: "relative",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  itemCountBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  itemCountText: { color: "#fff", fontSize: 9, fontFamily: fontFamilies.mono.semibold },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontFamily: fontFamilies.sans.medium, lineHeight: 20 },
  variantLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  linePrice: { fontFamily: fontFamilies.mono.semibold },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[1],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payText: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    textTransform: "capitalize",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  trackBtnText: {
    color: colors.olive[700],
    fontSize: 10,
    fontFamily: fontFamilies.sans.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
