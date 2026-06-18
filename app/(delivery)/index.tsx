import React, { useEffect, useState, useCallback, useRef } from "react";
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { getRiderOrders, getRiderPickupRuns, riderStartDelivery } from "@/lib/api";
import { useRiderRealtime } from "@/lib/hooks/useRiderRealtime";
import { useDriverShift } from "@/lib/hooks/useDriverShift";
import { useDriverLocation } from "@/lib/hooks/useDriverLocation";
import { useTheme } from "@/lib/theme/provider";
import {
  formatPrice,
  formatRelative,
  formatShiftElapsed,
  elapsedMs,
  urgencyLabel,
  mapsUrl,
  whatsappUrl,
  greeting,
  isCompleted,
} from "@/lib/utils/delivery-format";
import type { Order } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30_000;

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pickupRuns, setPickupRuns] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const { on: shiftOn, startedAt, toggle: toggleShift, shouldPing } = useDriverShift();
  useDriverLocation(shouldPing);

  // Tick once per minute for the shift timer + relative timestamps.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const [ordersRes, pickupRes] = await Promise.all([
      getRiderOrders(user.id),
      getRiderPickupRuns(user.id),
    ]);
    if (ordersRes.ok) setOrders(ordersRes.data);
    if (pickupRes.ok) setPickupRuns(pickupRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useRiderRealtime(user?.id, fetchOrders);

  // 30s polling while shift is on.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (shiftOn) {
      pollRef.current = setInterval(fetchOrders, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [shiftOn, fetchOrders]);

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
    failed: orders.filter((o) => ["returned", "cancelled"].includes(o.status)).length,
  };
  const successRate = stats.completed + stats.failed > 0
    ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100)
    : 100;

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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  // Use `now` to keep relative timestamps fresh.
  const _refresh = now;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDate}>
              {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
            <Text style={styles.heroGreeting}>
              {greeting()},{" "}
              <Text style={styles.heroName}>
                {user?.user_metadata?.full_name?.split(" ")[0] ?? "Rider"}
              </Text>
            </Text>
          </View>
          <ShiftPill on={shiftOn} startedAt={startedAt} onToggle={toggleShift} colors={colors} />
        </View>
        <Text style={styles.heroSub}>
          {stats.assigned} assigned{stats.outForDelivery > 0 ? `, ${stats.outForDelivery} out for delivery` : ""}
        </Text>
        {shiftOn && startedAt ? (
          <Text style={styles.shiftTimer}>
            <Ionicons name="timer-outline" size={12} color="rgba(255,255,255,0.8)" />{" "}
            On shift · {formatShiftElapsed(startedAt)}
          </Text>
        ) : null}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <KpiTile label="Assigned" value={stats.assigned} bg={isDark ? colors.secondary : "#eef3f8"} color={colors.foreground} />
        <KpiTile label="Completed" value={stats.completed} bg={isDark ? "#1a3a23" : "#dcfce7"} color="#16a34a" />
        <KpiTile label="Success" value={`${successRate}%`} bg={isDark ? colors.secondary : "#fef9c3"} color={isDark ? colors.primaryForeground : "#854d0e"} />
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(delivery)/scan" as any)}>
          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
          <Text style={styles.quickBtnText}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(delivery)/pickups" as any)}>
          <Ionicons name="return-down-back-outline" size={20} color={colors.primary} />
          <Text style={styles.quickBtnText}>Return pickups</Text>
        </TouchableOpacity>
      </View>

      {pickupRuns.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Store pickups</Text>
            <TouchableOpacity onPress={() => router.push("/(delivery)/store-pickups" as any)}>
              <Text style={styles.viewAll}>View all ({pickupRuns.length})</Text>
            </TouchableOpacity>
          </View>
          {pickupRuns.slice(0, 3).map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.routeCard, { flexDirection: "column", alignItems: "flex-start" }]}
              onPress={() => router.push(`/(delivery)/orders/${o.id}` as any)}
            >
              <Text style={styles.routeOrder}>{o.order_number}</Text>
              <Text style={styles.pickupMeta} numberOfLines={1}>
                Pick up from seller
                {(o as { pickup_warehouse?: { name?: string } }).pickup_warehouse?.name
                  ? ` · Hub: ${(o as { pickup_warehouse?: { name?: string } }).pickup_warehouse!.name}`
                  : ""}
                {" · "}
                {(o as { pickup_decision?: string }).pickup_decision?.replace(/_/g, " ") ?? "pending decision"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

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
                  if (addr?.line1) Linking.openURL(mapsUrl(addr));
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
            const urg = urgencyLabel(elapsedMs(order.placed_at));
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
                    {isCOD ? (
                      <View style={styles.codBadge}>
                        <Text style={styles.codText}>COD</Text>
                      </View>
                    ) : null}
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
                  {order.status === "shipped" ? (
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleStartDelivery(order)}
                      disabled={starting === order.id}
                    >
                      <Text style={styles.startBtnText}>
                        {starting === order.id ? "..." : "Start"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.routeArrow}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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

function ShiftPill({
  on,
  startedAt,
  onToggle,
  colors,
}: {
  on: boolean;
  startedAt: string | null;
  onToggle: (next?: boolean) => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: on ? "#16a34a" : "rgba(255,255,255,0.18)",
      }}
      onPress={() => onToggle()}
      accessibilityLabel={on ? "End shift" : "Start shift"}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: on ? "#fff" : "rgba(255,255,255,0.6)",
        }}
      />
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
        {on ? "ON" : "OFF"}
      </Text>
    </TouchableOpacity>
  );
}

function KpiTile({ label, value, bg, color }: { label: string; value: number | string; bg: string; color: string }) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: bg }]}>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  value: { fontSize: 24, fontWeight: "700" },
  label: { fontSize: 11, color: "#65684d", marginTop: 2, textAlign: "center" },
});

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 120 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { color: colors.mutedForeground },

    hero: {
      backgroundColor: colors.primary,
      padding: 24,
      paddingTop: 16,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    },
    heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    heroDate: { fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 },
    heroGreeting: { fontSize: 28, fontWeight: "700", color: colors.primaryForeground, marginTop: 6 },
    heroName: { color: "#f5f4ef" },
    heroSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 },
    shiftTimer: {
      fontSize: 12,
      color: "rgba(255,255,255,0.85)",
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    kpiRow: { flexDirection: "row", gap: 10, padding: 16 },
    kpiCard: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
    kpiValue: { fontSize: 24, fontWeight: "700", color: colors.foreground },
    kpiLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 2, textAlign: "center" },

    quickRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 8 },
    quickBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
    },
    quickBtnText: { fontSize: 13, fontWeight: "500", color: colors.foreground },
    routeOrder: { fontSize: 13, fontWeight: "600", color: colors.foreground, flex: 1 },
    pickupMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2, flex: 1 },

    section: { padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 12 },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    viewAll: { fontSize: 13, color: colors.primary, fontWeight: "600" },

    activeCard: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#86efac",
      padding: 16,
    },
    activeHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
    activeStatus: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
    activeOrder: { fontSize: 15, fontWeight: "700", color: colors.foreground, fontFamily: "monospace" },
    activeCustomer: { fontSize: 13, color: colors.foreground, marginTop: 4 },
    activeAddress: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    activeActions: { flexDirection: "row", gap: 8, marginTop: 14 },
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionBtnText: { fontSize: 13, color: colors.foreground, fontWeight: "500" },
    actionBtnTextPrimary: { color: colors.primaryForeground },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
    },
    emptyIcon: { fontSize: 36 },
    emptyTitle: { fontSize: 13, fontWeight: "600", color: colors.foreground, marginTop: 8 },
    emptySub: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },

    routeCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
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
    routeIndexText: { fontSize: 12, fontWeight: "700", color: "#3730a3" },
    routeInfo: { flex: 1 },
    routeHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    routeName: { fontSize: 13, fontWeight: "500", color: colors.foreground },
    codBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
    codText: { fontSize: 9, fontWeight: "700", color: "#92400e" },
    urgencyBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
    urgencyText: { fontSize: 9, fontWeight: "700" },
    routeAddress: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    routeMeta: { fontSize: 10, color: colors.mutedForeground, fontFamily: "monospace", marginTop: 2 },
    routeActions: { alignItems: "flex-end", gap: 6 },
    startBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    startBtnText: { color: colors.primaryForeground, fontSize: 11, fontWeight: "700" },
    routeArrow: { fontSize: 20, color: colors.mutedForeground },

    viewAllBtn: {
      marginHorizontal: 16,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    viewAllText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  });
}
