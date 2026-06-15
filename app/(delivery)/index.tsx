import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { getRiderOrders, riderStartDelivery } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Order } from "@/lib/types";

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function elapsedMs(iso: string) {
  return Date.now() - new Date(iso).getTime();
}

function urgencyLabel(ms: number) {
  const mins = ms / 60000;
  if (mins < 30) return { label: "Fresh", color: "#16a34a", bg: "#dcfce7" };
  if (mins < 90) return { label: "On time", color: "#d97706", bg: "#fef9c3" };
  if (mins < 180) return { label: "Aging", color: "#ea580c", bg: "#fff7ed" };
  return { label: "Late", color: "#dc2626", bg: "#fef2f2" };
}

function mapsUrl(addr?: Order["shipping_address"]) {
  if (!addr) return "#";
  const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(", "))}`;
}

function whatsappUrl(phone?: string) {
  if (!phone) return "#";
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return `https://wa.me/${cleaned.replace(/^\+/, "")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function isCompleted(s: string) {
  return ["delivered", "returned", "refunded", "cancelled"].includes(s);
}

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const res = await getRiderOrders(user.id);
    if (res.ok) setOrders(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => fetchOrders(), 30_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const activeDelivery = orders.find((o) => o.status === "out_for_delivery") || null;
  const stats = {
    assigned: orders.filter((o) => !isCompleted(o.status) && o.status !== "out_for_delivery").length,
    completed: orders.filter((o) => o.status === "delivered").length,
    outForDelivery: orders.filter((o) => o.status === "out_for_delivery").length,
    cashToCollect: orders
      .filter((o) => o.payment_method === "cod" && o.payment_status !== "paid" && !isCompleted(o.status))
      .reduce((s, o) => s + o.total, 0),
  };

  const routeStops = orders
    .filter((o) => !isCompleted(o.status))
    .slice(0, 5);

  const handleStartDelivery = async (order: Order) => {
    setStarting(order.id);
    const res = await riderStartDelivery(order.id);
    setStarting(null);
    if (res.ok) {
      Alert.alert("Out for delivery", `${order.order_number}\nOTP: ${res.data.otp}`);
      fetchOrders();
    } else {
      Alert.alert("Error", res.error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroDate}>
          {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <Text style={styles.heroGreeting}>
          {greeting()}, <Text style={styles.heroName}>{user?.user_metadata?.full_name?.split(" ")[0] ?? "Rider"}</Text>
        </Text>
        <Text style={styles.heroSub}>
          {stats.assigned} assigned{stats.outForDelivery > 0 ? `, ${stats.outForDelivery} out for delivery` : ""}
        </Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: "#eef3f8" }]}>
          <Text style={styles.kpiValue}>{stats.assigned}</Text>
          <Text style={styles.kpiLabel}>Assigned</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.kpiValue, { color: "#166534" }]}>{stats.completed}</Text>
          <Text style={styles.kpiLabel}>Completed</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: "#fef9c3" }]}>
          <Text style={[styles.kpiValue, { color: "#854d0e" }]}>{formatPrice(stats.cashToCollect)}</Text>
          <Text style={styles.kpiLabel}>Cash to collect</Text>
        </View>
      </View>

      {/* Active Delivery */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Delivery</Text>
        {activeDelivery ? (
          <TouchableOpacity
            style={styles.activeCard}
            onPress={() => router.push(`/(delivery)/orders/${activeDelivery.id}` as any)}
          >
            <View style={styles.activeHeader}>
              <View style={styles.activeDot} />
              <Text style={styles.activeStatus}>Out for delivery</Text>
            </View>
            <Text style={styles.activeOrder}>{activeDelivery.order_number}</Text>
            <Text style={styles.activeCustomer}>
              {activeDelivery.shipping_address?.full_name ?? "Customer"}
            </Text>
            <Text style={styles.activeAddress} numberOfLines={1}>
              {activeDelivery.shipping_address?.line1}, {activeDelivery.shipping_address?.city}
            </Text>
            <View style={styles.activeActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  const addr = activeDelivery.shipping_address;
                  if (addr?.line1) {
                    const url = mapsUrl(addr);
                    Linking.openURL(url);
                  }
                }}
              >
                <Text style={styles.actionBtnText}>📍 Navigate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  const phone = activeDelivery.shipping_address?.phone;
                  if (phone) Linking.openURL(whatsappUrl(phone));
                }}
              >
                <Text style={styles.actionBtnText}>💬 Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => router.push(`/(delivery)/orders/${activeDelivery.id}` as any)}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Verify →</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyTitle}>No active delivery</Text>
            <Text style={styles.emptySub}>Start a delivery to see it here</Text>
          </View>
        )}
      </View>

      {/* Today's Route */}
      {routeStops.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Route</Text>
          {routeStops.map((order, i) => {
            const ship = order.shipping_address;
            const isCOD = order.payment_method === "cod" && order.payment_status !== "paid";
            const elapsed = elapsedMs(order.placed_at);
            const urg = urgencyLabel(elapsed);
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.routeCard}
                onPress={() => router.push(`/(delivery)/orders/${order.id}` as any)}
              >
                <View style={styles.routeIndex}>
                  <Text style={styles.routeIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeName}>{ship?.full_name ?? "Customer"}</Text>
                    {isCOD && <View style={styles.codBadge}><Text style={styles.codText}>COD</Text></View>}
                    <View style={[styles.urgencyBadge, { backgroundColor: urg.bg }]}>
                      <Text style={[styles.urgencyText, { color: urg.color }]}>{urg.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.routeAddress} numberOfLines={1}>
                    {ship?.line1}, {ship?.city}
                  </Text>
                  <Text style={styles.routeMeta}>
                    {order.order_number} · {formatRelative(order.placed_at)}
                  </Text>
                </View>
                <View style={styles.routeActions}>
                  {order.status === "shipped" && (
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleStartDelivery(order)}
                      disabled={starting === order.id}
                    >
                      <Text style={styles.startBtnText}>
                        {starting === order.id ? "..." : "Start"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.routeArrow}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* View All Button */}
      <TouchableOpacity
        style={styles.viewAllBtn}
        onPress={() => router.push("/(delivery)/orders" as any)}
      >
        <Text style={styles.viewAllText}>View all deliveries →</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: colors.light.mutedForeground },

  hero: {
    backgroundColor: colors.light.primary,
    padding: 24,
    paddingTop: 16,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  heroDate: { fontSize: typography.fontSizes.xs, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 },
  heroGreeting: { fontSize: 28, fontWeight: typography.fontWeights.bold as any, color: colors.light.card, marginTop: 6 },
  heroName: { color: "#f5f4ef" },
  heroSub: { fontSize: typography.fontSizes.sm, color: "rgba(255,255,255,0.7)", marginTop: 6 },

  kpiRow: { flexDirection: "row", gap: 10, padding: 16 },
  kpiCard: { flex: 1, padding: 14, borderRadius: radii.lg, alignItems: "center" },
  kpiValue: { fontSize: 24, fontWeight: typography.fontWeights.bold as any, color: colors.light.foreground },
  kpiLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2, textAlign: "center" },

  section: { padding: 16 },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 12,
  },

  activeCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#86efac",
    padding: 16,
  },
  activeHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  activeStatus: { fontSize: typography.fontSizes.xs, color: "#16a34a", fontWeight: typography.fontWeights.semibold as any },
  activeOrder: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.bold as any, color: colors.light.foreground, fontFamily: "monospace" },
  activeCustomer: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginTop: 4 },
  activeAddress: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  activeActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  actionBtnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  actionBtnText: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, fontWeight: typography.fontWeights.medium as any },
  actionBtnTextPrimary: { color: colors.light.card },

  emptyCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold as any, color: colors.light.foreground, marginTop: 8 },
  emptySub: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },

  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  routeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  routeIndexText: { fontSize: 12, fontWeight: typography.fontWeights.bold as any, color: "#3730a3" },
  routeInfo: { flex: 1 },
  routeHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeName: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium as any, color: colors.light.foreground },
  codBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full },
  codText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any, color: "#92400e" },
  urgencyBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full },
  urgencyText: { fontSize: 9, fontWeight: typography.fontWeights.bold as any },
  routeAddress: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  routeMeta: { fontSize: 10, color: colors.light.mutedForeground, fontFamily: "monospace", marginTop: 2 },
  routeActions: { alignItems: "flex-end", gap: 6 },
  startBtn: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  startBtnText: { color: colors.light.card, fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold as any },
  routeArrow: { fontSize: 20, color: colors.light.mutedForeground },

  viewAllBtn: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  viewAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.semibold as any,
  },
});
