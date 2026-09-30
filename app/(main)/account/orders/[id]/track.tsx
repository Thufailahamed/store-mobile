import React, { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Badge, Button, useToast } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { getOrderTracking, type OrderTracking, type TrackingEvent } from "@/lib/api";
import { getShipmentByOrder, type CourierShipment } from "@/lib/api/courier-api";
import { useTrackEvent } from "@/lib/recommender";
import { formatPrice } from "@/lib/utils";
import { isExternalCourierEnabledMobile } from "@/lib/feature-flags";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { supabase } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/types";

const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const STATUS_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; copy: string }> = {
  pending: { label: "Order placed", icon: "receipt-outline", copy: "We've got your order." },
  confirmed: { label: "Confirmed", icon: "checkmark-circle-outline", copy: "Seller confirmed." },
  processing: { label: "Being prepared", icon: "construct-outline", copy: "The seller is packing your order." },
  packed: { label: "Packed", icon: "cube-outline", copy: "Handed to the courier." },
  shipped: { label: "Shipped", icon: "paper-plane-outline", copy: "On the way to your city." },
  out_for_delivery: { label: "Out for delivery", icon: "bicycle-outline", copy: "Rider is on the way." },
  delivered: { label: "Delivered", icon: "gift-outline", copy: "Enjoy your order." },
  cancelled: { label: "Cancelled", icon: "close-circle-outline", copy: "Order cancelled." },
  returned: { label: "Returned", icon: "refresh-outline", copy: "Items returned." },
  refunded: { label: "Refunded", icon: "card-outline", copy: "Refund issued." },
};

export default function OrderTrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const tracker = useTrackEvent();
  const [data, setData] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courier, setCourier] = useState<CourierShipment | null>(null);

  const load = async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    const res = await getOrderTracking(id);
    if (!res.ok) {
      toast(res.error, "error");
      setLoading(false);
      return;
    }
    setData(res.data);
    // External courier (Phase 0162). Best-effort fetch — never fails the page.
    if (isExternalCourierEnabledMobile()) {
      const c = await getShipmentByOrder(id);
      if (c.ok) setCourier(c.data.shipment);
    }
    setLoading(false);
    tracker.screen("order_tracking", {
      orderId: id,
      status: res.data.order?.status,
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const uniqueId = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`order-track-${id}-${uniqueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        void load(false);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tracking_events", filter: `order_id=eq.${id}` }, () => {
        void load(false);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "package_scan_events", filter: `order_id=eq.${id}` }, () => {
        void load(false);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Track order" onBack={() => router.back()} />
        <View style={styles.center}>
          <Body muted>{loading ? "Loading tracking…" : "Order not found"}</Body>
        </View>
      </SafeAreaView>
    );
  }

  const { order, events, rider } = data;
  const isException = (["cancelled", "returned", "refunded"] as OrderStatus[]).includes(
    order.status as OrderStatus
  );

  // For terminal exception statuses, `order.status` itself isn't in
  // STATUS_ORDER (indexOf would be -1), which used to clamp the whole
  // timeline to step 0 and hide any progress made before the order
  // diverged. Instead, look at the order's status history to find the
  // furthest happy-path step it actually reached.
  const reachedStep = isException
    ? (() => {
        const fromEvents = events
          .map((ev) => STATUS_ORDER.indexOf(ev.status as OrderStatus))
          .filter((i) => i >= 0);
        if (fromEvents.length > 0) return Math.max(...fromEvents);
        // returned/refunded can only happen after delivery
        if (order.status === "returned" || order.status === "refunded") {
          return STATUS_ORDER.length - 1;
        }
        return 0;
      })()
    : Math.max(0, STATUS_ORDER.indexOf(order.status as OrderStatus));

  const visibleSteps = isException ? STATUS_ORDER.slice(0, reachedStep + 1) : STATUS_ORDER;
  const currentStep = reachedStep;
  const isTerminal = order.status === "delivered" || isException;
  const exceptionTone =
    order.status === "cancelled"
      ? colors.light.destructive
      : order.status === "returned"
        ? colors.accent2.rust
        : colors.accent2.ochre;

  const heroMeta = STATUS_META[order.status];
  const heroTone = isException ? exceptionTone : colors.accent2.ochre;
  const totalSteps = STATUS_ORDER.length;
  const stepsDone = isException ? reachedStep + 1 : currentStep + 1;

  // First time each status was reached, for per-step timestamps.
  const reachedAt: Record<string, string> = {};
  for (const ev of events) {
    if (!reachedAt[ev.status] || ev.created_at < reachedAt[ev.status]) {
      reachedAt[ev.status] = ev.created_at;
    }
  }
  if (!reachedAt.pending && order.placed_at) reachedAt.pending = order.placed_at;

  const activity = events.slice().reverse();

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Track order" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[4] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Status hero ───────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.orderChip}>
              <Label style={styles.orderChipText} selectable>
                #{order.order_number}
              </Label>
            </View>
            {!isTerminal ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Label style={styles.liveText}>LIVE</Label>
              </View>
            ) : null}
          </View>

          <View style={styles.heroMain}>
            <View style={[styles.heroIcon, { borderColor: heroTone + "66" }]}>
              <Ionicons name={heroMeta?.icon ?? "cube-outline"} size={24} color={heroTone} />
            </View>
            <View style={{ flex: 1 }}>
              <Display size="2xl" style={styles.heroTitle}>
                {heroMeta?.label ?? order.status.replace(/_/g, " ")}
              </Display>
              <Body size="sm" style={styles.heroCopy}>
                {heroMeta?.copy ?? ""}
              </Body>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              {STATUS_ORDER.map((step, i) => (
                <View
                  key={step}
                  style={[
                    styles.progressSeg,
                    i < stepsDone && { backgroundColor: i === stepsDone - 1 ? heroTone : colors.olive[300] },
                  ]}
                />
              ))}
            </View>
            <Label style={styles.progressLabel}>
              {isException ? "STOPPED" : `STEP ${stepsDone} OF ${totalSteps}`}
            </Label>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroFacts}>
            <View style={styles.heroFact}>
              <Label style={styles.heroFactKey}>PLACED</Label>
              <Body size="sm" style={styles.heroFactVal}>
                {fmtDate(order.placed_at)}
              </Body>
            </View>
            <View style={styles.heroFact}>
              <Label style={styles.heroFactKey}>TOTAL</Label>
              <Body size="sm" style={styles.heroFactVal}>
                {formatPrice(order.total, order.currency)}
              </Body>
            </View>
          </View>
          {order.shipping_address ? (
            <View style={styles.heroAddress}>
              <Ionicons name="location-outline" size={14} color={colors.olive[300]} />
              <Body size="xs" numberOfLines={1} style={styles.heroAddressText}>
                {order.shipping_address.line1}, {order.shipping_address.city}
              </Body>
            </View>
          ) : null}
        </View>

        {courier ? (
          <View style={styles.riderCard}>
            <View style={styles.riderLeft}>
              <View style={styles.riderIcon}>
                <Ionicons name="bicycle-outline" size={20} color={colors.olive[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.riderKicker}>EXTERNAL COURIER</Label>
                <Body size="sm" style={styles.riderName}>
                  {courier.provider_name}
                </Body>
                <Body muted size="xs">
                  Status: {courier.status.replace(/_/g, " ")}
                </Body>
                {courier.external_tracking_id ? (
                  <Body muted size="xs" selectable>
                    Tracking: {courier.external_tracking_id}
                  </Body>
                ) : null}
              </View>
            </View>
            {courier.external_tracking_url ? (
              <TouchableOpacity
                style={styles.riderCall}
                // M-16 AUDIT: Route through safeOpenUrl instead of raw Linking.openURL.
                onPress={() => safeOpenUrl(courier.external_tracking_url)}
              >
                <Ionicons name="open-outline" size={18} color={colors.olive[700]} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {rider ? (
          <View style={styles.riderCard}>
            <View style={styles.riderLeft}>
              <View style={styles.riderIcon}>
                <Ionicons name="bicycle-outline" size={20} color={colors.olive[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Label style={styles.riderKicker}>YOUR RIDER</Label>
                <Body size="sm" style={styles.riderName}>
                  {rider.name}
                </Body>
              </View>
            </View>
            {rider.phone ? (
              <TouchableOpacity
                onPress={() => safeOpenUrl(`tel:${rider.phone}`)}
                style={styles.callBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={14} color={colors.light.primaryForeground} />
                <Label style={styles.callLabel}>CALL</Label>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ── Progress timeline ─────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Label style={styles.sectionKicker}>JOURNEY</Label>
          <Display size="xl">Progress</Display>
        </View>
        <View style={styles.card}>
          {visibleSteps.map((step, i) => {
            const done = i < currentStep || (i === currentStep && isTerminal);
            const current = i === currentStep && !isTerminal;
            const meta = STATUS_META[step];
            const isLastRow = i === visibleSteps.length - 1 && !isException;
            const lineDone = i < currentStep || (isException && i === visibleSteps.length - 1);
            const at = reachedAt[step];
            return (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  {current ? (
                    <View style={styles.stepDotCurrentHalo}>
                      <View style={styles.stepDotCurrent}>
                        <Ionicons name={meta?.icon ?? "ellipse"} size={13} color={colors.light.primaryForeground} />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.stepDot, done && styles.stepDotDone]}>
                      {done ? (
                        <Ionicons name="checkmark" size={12} color={colors.light.primaryForeground} />
                      ) : (
                        <View style={styles.stepDotInner} />
                      )}
                    </View>
                  )}
                  {!isLastRow ? <View style={[styles.stepLine, lineDone && styles.stepLineDone]} /> : null}
                </View>
                <View style={[styles.stepBody, isLastRow && { paddingBottom: 0 }]}>
                  <View style={styles.stepTitleRow}>
                    <Body
                      size="sm"
                      style={[
                        styles.stepLabel,
                        (done || current) && styles.stepLabelDone,
                      ]}
                    >
                      {meta?.label ?? step}
                    </Body>
                    {current ? (
                      <View style={styles.nowPill}>
                        <Label style={styles.nowText}>NOW</Label>
                      </View>
                    ) : null}
                  </View>
                  {current ? (
                    <Body muted size="xs" style={{ marginTop: 2 }}>
                      {meta?.copy}
                    </Body>
                  ) : null}
                  {(done || current) && at ? (
                    <Label style={styles.stepTime}>{fmtDateTime(at)}</Label>
                  ) : null}
                </View>
              </View>
            );
          })}
          {isException ? (
            <View style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={[styles.stepDot, { backgroundColor: exceptionTone }]}>
                  <Ionicons name="close" size={12} color={colors.light.primaryForeground} />
                </View>
              </View>
              <View style={[styles.stepBody, { paddingBottom: 0 }]}>
                <Body size="sm" style={[styles.stepLabel, styles.stepLabelDone, { color: exceptionTone }]}>
                  {STATUS_META[order.status]?.label ?? order.status}
                </Body>
                <Body muted size="xs" style={{ marginTop: 2 }}>
                  {STATUS_META[order.status]?.copy}
                </Body>
                {reachedAt[order.status] ? (
                  <Label style={styles.stepTime}>{fmtDateTime(reachedAt[order.status])}</Label>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Activity feed ─────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Label style={styles.sectionKicker}>UPDATES</Label>
          <Display size="xl">Activity</Display>
        </View>
        <View style={[styles.card, { paddingVertical: spacing[2] }]}>
          {activity.map((ev, i) => {
            const label = STATUS_META[ev.status]?.label ?? ev.status.replace(/_/g, " ");
            const desc = ev.description?.trim();
            const showDesc = !!desc && desc.toLowerCase() !== label.toLowerCase();
            const isLast = i === activity.length - 1;
            return (
              <View key={ev.id} style={[styles.eventRow, !isLast && styles.eventRowBorder]}>
                <View style={[styles.eventIcon, i === 0 && styles.eventIconLatest]}>
                  <Ionicons
                    name={STATUS_META[ev.status]?.icon ?? "ellipse-outline"}
                    size={15}
                    color={i === 0 ? colors.light.primaryForeground : colors.olive[600]}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.stepTitleRow}>
                    <Body size="sm" style={styles.eventTitle}>
                      {label}
                    </Body>
                    {i === 0 ? (
                      <Badge style={{ backgroundColor: colors.olive[100] }}>
                        <Label style={{ color: colors.olive[700], fontSize: 9 }}>LATEST</Label>
                      </Badge>
                    ) : null}
                  </View>
                  {showDesc ? (
                    <Body muted size="xs">
                      {desc}
                    </Body>
                  ) : null}
                  <Label style={styles.eventTime}>
                    {fmtDateTime(ev.created_at)}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </Label>
                </View>
              </View>
            );
          })}
        </View>

        <Button
          variant="outline"
          onPress={() =>
            router.push({
              pathname: "/(main)/account/orders/[id]" as never,
              params: { id: order.id },
            })
          }
        >
          View order details
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[4] },

  // Hero
  heroCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["3xl"],
    padding: spacing[5],
    gap: spacing[4],
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.14)",
  },
  orderChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[100],
    letterSpacing: 0.4,
  },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent2.ochre },
  liveText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent2.ochre,
  },
  heroMain: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    backgroundColor: "rgba(250,248,241,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: colors.paper.cream },
  heroCopy: { color: colors.olive[200], marginTop: 2 },
  progressWrap: { gap: spacing[2] },
  progressTrack: { flexDirection: "row", gap: 4 },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(250,248,241,0.14)",
  },
  progressLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.olive[300],
  },
  heroDivider: { height: 1, backgroundColor: "rgba(250,248,241,0.1)" },
  heroFacts: { flexDirection: "row", gap: spacing[6] },
  heroFact: { gap: 2 },
  heroFactKey: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.olive[300],
  },
  heroFactVal: { color: colors.paper.cream, fontFamily: fontFamilies.sans.semibold },
  heroAddress: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -spacing[1] },
  heroAddressText: { color: colors.olive[200], flex: 1 },

  // Rider / courier
  riderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  riderLeft: { flexDirection: "row", gap: spacing[3], alignItems: "center", flex: 1 },
  riderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  riderKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  riderName: { fontFamily: fontFamilies.sans.semibold },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.primary,
  },
  riderCall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  callLabel: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
  },

  // Sections
  sectionHead: { marginTop: spacing[2], gap: 2 },
  sectionKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.light.mutedForeground,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },

  // Timeline
  stepRow: { flexDirection: "row", gap: spacing[3] },
  stepRail: { alignItems: "center", width: 30 },
  stepDot: {
    width: 22,
    height: 22,
    marginTop: 4,
    borderRadius: 11,
    backgroundColor: colors.light.muted,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  stepDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.border },
  stepDotCurrentHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent2.ochre + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    flex: 1,
    width: 2,
    minHeight: 16,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: colors.light.border,
  },
  stepLineDone: { backgroundColor: colors.light.primary },
  stepBody: { flex: 1, paddingTop: 5, paddingBottom: spacing[5] },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  stepLabel: { color: colors.light.mutedForeground },
  stepLabelDone: { color: colors.light.foreground, fontFamily: fontFamilies.sans.semibold },
  stepTime: {
    marginTop: 4,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.light.mutedForeground,
  },
  nowPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.ochre + "26",
  },
  nowText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#8a6d22",
  },

  // Activity
  eventRow: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
    paddingVertical: spacing[3],
  },
  eventRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.light.border },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  eventIconLatest: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  eventTitle: { fontFamily: fontFamilies.sans.semibold, flexShrink: 1 },
  eventTime: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.light.mutedForeground,
  },
});
