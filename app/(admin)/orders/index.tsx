import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { orderStatusTone } from "@/lib/seller/status-tones";
import {
  formatCheckoutPayment,
  formatPaymentStatus,
  formatOrderStatusLabel,
  firstLineItem,
  countOrderUnits,
} from "@/lib/orders/seller-list";
import {
  INK,
  LIME,
  HAIRLINE,
  cardSurface,
  Chip,
  SearchBar,
  Empty,
  SectionCount,
  kit,
} from "@/components/admin/catalog-kit";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const STATUS_DOT: Record<string, string | undefined> = {
  all: undefined,
  pending: "#e0a526",
  confirmed: colors.olive[400],
  processing: colors.olive[600],
  shipped: colors.accent2.rust,
  delivered: "#22a35a",
  cancelled: "#9a9c8c",
};

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

const IN_FLIGHT = new Set(["confirmed", "processing", "shipped", "out_for_delivery"]);

function OrderStatusPill({ status }: { status: string }) {
  const tone = orderStatusTone(status);
  return (
    <View style={[kit.statusPill, { backgroundColor: tone.bg }]}>
      <View style={[kit.statusDot, { backgroundColor: tone.text }]} />
      <Text style={[kit.statusText, { color: tone.text }]}>
        {formatOrderStatusLabel(status)}
      </Text>
    </View>
  );
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

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>DISPATCH & FULFILLMENT</Text>
          </View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>
            Track fulfilment, payments and delivery across every consignment.
          </Text>
        </View>
        <Pressable
          onPress={() => ordersQuery.refetch()}
          style={({ pressed }) => [styles.roundBtn, pressed && kit.pressed]}
          accessibilityLabel="Refresh orders"
        >
          <Ionicons name="refresh-outline" size={17} color={INK} />
        </Pressable>
      </View>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search order #, customer, or phone…"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {STATUS_TABS.map((tab) => (
          <Chip
            key={tab.key}
            label={tab.label}
            dot={STATUS_DOT[tab.key]}
            active={status === tab.key}
            onPress={() => setStatus(tab.key)}
          />
        ))}
      </ScrollView>

      {!ordersQuery.isLoading && orders.length > 0 && !isFiltered ? (
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
      ) : null}

      {!ordersQuery.isLoading ? (
        <View style={styles.countRow}>
          <SectionCount>
            {orders.length} {orders.length === 1 ? "ORDER" : "ORDERS"}
            {isFiltered ? " MATCHING" : ""}
          </SectionCount>
          {isFiltered ? (
            <Pressable onPress={resetFilters} hitSlop={8}>
              <Text style={styles.clearText}>CLEAR</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderOrder = ({ item, index }: { item: Order; index: number }) => {
    const user = (item as any).user;
    const customerName = user?.full_name ?? user?.email ?? "Direct Customer";
    const orderNumber = item.order_number ?? item.id.slice(0, 8).toUpperCase();
    const items = (item as any).items ?? (item as any).order_items;
    const units =
      countOrderUnits(items) ??
      (Array.isArray(items) && items.length > 0 ? items.length : null);
    const line = firstLineItem(items);
    const extraUnits = units != null && units > 1 ? units - 1 : 0;
    const method = formatCheckoutPayment(item.payment_method);
    const payStatus = formatPaymentStatus(item.payment_status);
    const codUnpaid = item.payment_method === "cod" && item.payment_status !== "paid";

    return (
      <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
        <View style={[styles.card, codUnpaid && styles.cardWarn]}>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/(admin)/orders/[id]", params: { id: item.id } })
            }
            style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.thumb}>
              {line?.imageUrl ? (
                <Image
                  source={{ uri: line.imageUrl }}
                  style={styles.thumbImg}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.thumbEmpty}>
                  <Ionicons name="receipt-outline" size={20} color="rgba(22,23,15,0.25)" />
                </View>
              )}
              {extraUnits > 0 ? (
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>+{extraUnits}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.info}>
              <View style={styles.topRow}>
                <Text style={styles.orderLabel} numberOfLines={1}>
                  #{orderNumber} · {formatRelative(item.placed_at ?? (item as any).created_at)}
                </Text>
                <OrderStatusPill status={item.status} />
              </View>
              <Text style={styles.customerName} numberOfLines={1}>
                {customerName}
              </Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {line?.name ?? "Order items"}
                {line?.variant ? ` · ${line.variant}` : ""}
                {units != null ? `  ·  ${units} ${units === 1 ? "item" : "items"}` : ""}
              </Text>
              <View style={styles.bottomRow}>
                <Text style={styles.price}>
                  {formatPrice(item.total, item.currency ?? "LKR")}
                </Text>
                <View style={[styles.payPill, codUnpaid && styles.payPillWarn]}>
                  <Ionicons
                    name={codUnpaid ? "alert-circle-outline" : "card-outline"}
                    size={11}
                    color={codUnpaid ? colors.accent2.rust : colors.ink.mute}
                  />
                  <Text
                    style={[styles.payPillText, codUnpaid && styles.payPillTextWarn]}
                    numberOfLines={1}
                  >
                    {method} · {payStatus}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Ionicons name="arrow-forward" size={14} color="rgba(22,23,15,0.35)" />
              </View>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl
            refreshing={ordersQuery.isFetching}
            onRefresh={() => ordersQuery.refetch()}
            tintColor={colors.olive[800]}
            colors={[colors.olive[800]]}
          />
        }
        ListEmptyComponent={
          ordersQuery.isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={110} style={{ borderRadius: 24 }} />
              ))}
            </View>
          ) : (
            <Empty
              icon={isFiltered ? "funnel-outline" : "receipt-outline"}
              title={isFiltered ? "No matching orders" : "No orders yet"}
              body={
                isFiltered
                  ? "No orders match the current keyword or status filter."
                  : "When customers place orders, they will stream here in real-time."
              }
              onReset={isFiltered ? resetFilters : undefined}
            />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingHorizontal: 18, paddingBottom: 120 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 18,
    marginBottom: 18,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.olive[700],
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.6,
    color: INK,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink.mute,
    maxWidth: 300,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...shadows.soft,
  },

  /* Chips */
  chips: { gap: 7, paddingBottom: 14 },

  /* Summary card */
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
    ...shadows.editorial,
  },
  summaryCell: { flex: 1, gap: 2 },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(250,248,241,0.14)",
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: "rgba(250,248,241,0.45)",
  },
  summaryValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.paper.cream,
    letterSpacing: -0.3,
  },
  summaryValueWarn: { color: LIME },

  /* Section count */
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: colors.accent2.rust,
    marginBottom: 10,
  },

  /* Order card */
  card: { ...cardSurface, borderRadius: 24, marginBottom: 12, overflow: "hidden" },
  cardWarn: { borderColor: "rgba(184,92,58,0.45)" },
  orderRow: { flexDirection: "row", gap: 13, padding: 10 },
  thumb: {
    width: 64,
    height: 82,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  thumbBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.paper.cream,
  },
  info: { flex: 1, paddingTop: 2, paddingRight: 4, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderLabel: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  customerName: {
    marginTop: 5,
    fontFamily: fontFamilies.display.regular,
    fontSize: 17,
    letterSpacing: -0.3,
    color: INK,
  },
  itemName: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: "rgba(22,23,15,0.5)",
  },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: INK },
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(22,23,15,0.05)",
    flexShrink: 1,
  },
  payPillWarn: { backgroundColor: "rgba(184,92,58,0.12)" },
  payPillText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: colors.ink.mute,
  },
  payPillTextWarn: { color: colors.accent2.rust },
});
