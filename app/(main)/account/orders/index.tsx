import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Badge, Skeleton } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { getOrders } from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

type Tab = "all" | "active" | "shipped" | "delivered" | "cancelled";

const STATUS_TONE: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre },
  confirmed: { label: "Confirmed", bg: colors.olive[100], fg: colors.olive[700] },
  processing: { label: "Processing", bg: colors.olive[100], fg: colors.olive[700] },
  shipped: { label: "Shipped", bg: colors.olive[100], fg: colors.olive[700] },
  out_for_delivery: { label: "Out for delivery", bg: colors.olive[200], fg: colors.olive[800] },
  delivered: { label: "Delivered", bg: colors.olive[200], fg: colors.olive[800] },
  cancelled: { label: "Cancelled", bg: colors.light.destructive + "20", fg: colors.light.destructive },
  returned: { label: "Returned", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre },
  refunded: { label: "Refunded", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre },
};

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "processing"];

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    getOrders(userId, 50).then((res) => {
      if (cancelled) return;
      if (res.ok) setOrders(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const counts = useMemo(() => ({
    all: orders.length,
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    shipped: orders.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "returned" || o.status === "refunded").length,
  }), [orders]);

  const lifetimeSpend = useMemo(
    () => orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? (o.total ?? 0) : 0), 0),
    [orders]
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
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="My orders" />
        <View style={styles.loading}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ paddingHorizontal: 20 }}>
              <Skeleton height={120} borderRadius={radii.xl} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="My orders" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Purchase history</Label>
            <Display size="2xl" style={styles.heroTitle}>
              Threads, tracked
            </Display>
            <Body muted>Every parcel, every refund, every review prompt.</Body>
          </View>
          <View style={styles.bagBadge}>
            <Ionicons name="bag-handle-outline" size={18} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Lifetime" value={counts.all} icon="archive-outline" />
          <Stat label="Active" value={counts.active} icon="bicycle-outline" />
          <Stat label="Delivered" value={counts.delivered} icon="checkmark-circle-outline" />
          <Stat label="Spent" value={formatPrice(lifetimeSpend)} icon="card-outline" small />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={14} color={colors.light.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search orders, items, or numbers"
              placeholderTextColor={colors.light.mutedForeground}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.tabs}>
          {(["all", "active", "shipped", "delivered", "cancelled"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Body size="xs" style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t[0].toUpperCase() + t.slice(1)}
              </Body>
              <Body size="xs" style={[styles.tabCount, tab === t && styles.tabCountActive]}>
                {counts[t]}
              </Body>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bag-outline" size={28} color={colors.light.mutedForeground} />
            </View>
            <Display size="xl">No orders found</Display>
            <Body muted>{orders.length === 0 ? "Start shopping to fill this page." : "Try a different filter or search."}</Body>
            {orders.length === 0 && (
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.push("/(main)/products" as never)}>
                <Label style={styles.shopBtnText}>Browse products</Label>
                <Ionicons name="arrow-forward" size={14} color={colors.light.primaryForeground} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((o) => {
              const tone = STATUS_TONE[o.status] || STATUS_TONE.pending;
              const firstItem = o.items?.[0];
              const firstImg = firstItem?.product?.images?.find((i) => i.is_primary)?.url
                ?? firstItem?.product?.images?.[0]?.url;
              const moreCount = (o.items?.length ?? 0) - 1;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={styles.card}
                  onPress={() => router.push(`/(main)/account/orders/${o.id}` as never)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardStripe} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTop}>
                      <View>
                        <Label style={styles.kicker}>Order</Label>
                        <Body size="sm" style={styles.orderNumber}>#{o.order_number}</Body>
                      </View>
                      <Badge style={{ backgroundColor: tone.bg }}>
                        <Label style={{ color: tone.fg, fontSize: 10 }}>{tone.label}</Label>
                      </Badge>
                    </View>

                    {firstItem && (
                      <View style={styles.firstItem}>
                        {firstImg ? (
                          <Avatar uri={firstImg} size={42} style={{ borderRadius: radii.lg }} />
                        ) : (
                          <View style={styles.firstItemPlaceholder}>
                            <Ionicons name="cube-outline" size={18} color={colors.light.mutedForeground} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Body size="sm" numberOfLines={1}>{firstItem.product_name}</Body>
                          {firstItem.variant_label && <Body muted size="xs">{firstItem.variant_label}</Body>}
                        </View>
                        <Body muted size="xs">×{firstItem.quantity}</Body>
                      </View>
                    )}

                    {moreCount > 0 && (
                      <Body muted size="xs" style={styles.moreItems}>+{moreCount} more item{moreCount === 1 ? "" : "s"}</Body>
                    )}

                    <View style={styles.cardFooter}>
                      <View>
                        <Label style={styles.kicker}>Placed</Label>
                        <Body size="xs" style={styles.footerValue}>
                          {new Date(o.placed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </Body>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Label style={styles.kicker}>Total</Label>
                        <Price style={styles.totalValue}>{formatPrice(o.total, o.currency)}</Price>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, small }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; small?: boolean }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <Display size={small ? "md" : "lg"} numberOfLines={1}>{typeof value === "number" ? value.toLocaleString() : value}</Display>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, paddingTop: spacing[5], gap: 12 },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  bagBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing[5] },
  statCard: {
    width: "48%",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: 4,
  },
  statLabel: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.xs },
  searchRow: { marginBottom: spacing[3] },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { color: colors.light.mutedForeground, fontFamily: fontFamilies.mono.medium },
  tabTextActive: { color: colors.light.primaryForeground },
  tabCount: { color: colors.light.mutedForeground, fontSize: 9, fontFamily: fontFamilies.mono.regular, opacity: 0.7 },
  tabCountActive: { color: colors.light.primaryForeground, opacity: 0.85 },
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
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.light.primary,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: spacing[2],
  },
  shopBtnText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.soft,
  },
  cardStripe: {
    width: 4,
    backgroundColor: colors.light.primary,
  },
  cardContent: { flex: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  orderNumber: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginTop: 2 },
  firstItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.olive[50] + "60",
    borderRadius: radii.lg,
  },
  firstItemPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moreItems: { marginTop: -4 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  footerValue: { color: colors.light.foreground, marginTop: 2 },
  totalValue: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.base, color: colors.olive[800] },
});
