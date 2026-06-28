import React, { useEffect, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Track order" onBack={() => router.back()} />
        <View style={styles.center}>
          <Body muted>{loading ? "Loading tracking…" : "Order not found"}</Body>
        </View>
      </SafeAreaView>
    );
  }

  const { order, events, rider } = data;
  const currentStep = Math.max(
    0,
    STATUS_ORDER.indexOf(order.status as OrderStatus)
  );
  const isTerminal = ["delivered", "cancelled", "returned", "refunded"].includes(
    order.status
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={`Tracking · #${order.order_number}`}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons
                name={STATUS_META[order.status]?.icon ?? "cube-outline"}
                size={26}
                color={colors.olive[700]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label style={styles.heroKicker}>
                {(STATUS_META[order.status]?.label ?? order.status).toUpperCase()}
              </Label>
              <Body size="sm" style={styles.heroCopy}>
                {STATUS_META[order.status]?.copy ?? ""}
              </Body>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Body muted size="xs">
              Placed {new Date(order.placed_at).toLocaleDateString()} ·{" "}
              {formatPrice(order.total, order.currency)}
            </Body>
            {order.shipping_address ? (
              <Body muted size="xs" numberOfLines={1} style={styles.heroAddress}>
                → {order.shipping_address.line1}, {order.shipping_address.city}
              </Body>
            ) : null}
          </View>
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
                onPress={() => Linking.openURL(courier.external_tracking_url!)}
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
                onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                style={styles.callBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={14} color={colors.light.primary} />
                <Label style={styles.callLabel}>CALL</Label>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Display size="lg" style={styles.sectionTitle}>
          Progress
        </Display>
        <View style={styles.timeline}>
          {STATUS_ORDER.map((step, i) => {
            const done = i <= currentStep;
            const current = i === currentStep && !isTerminal;
            const meta = STATUS_META[step];
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      done && styles.timelineDotDone,
                      current && styles.timelineDotCurrent,
                    ]}
                  >
                    {done ? (
                      <Ionicons
                        name="checkmark"
                        size={11}
                        color={colors.light.primaryForeground}
                      />
                    ) : null}
                  </View>
                  {i < STATUS_ORDER.length - 1 && (
                    <View
                      style={[styles.timelineLine, done && styles.timelineLineDone]}
                    />
                  )}
                </View>
                <View style={styles.timelineBody}>
                  <Body
                    size="sm"
                    style={[
                      styles.timelineLabel,
                      done && styles.timelineLabelDone,
                    ]}
                  >
                    {meta?.label ?? step}
                  </Body>
                  {current ? (
                    <Body muted size="xs">
                      {meta?.copy}
                    </Body>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <Display size="lg" style={styles.sectionTitle}>
          Activity
        </Display>
        <View style={styles.eventsCard}>
          {events
            .slice()
            .reverse()
            .map((ev, i) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Body size="sm" style={styles.eventTitle}>
                    {ev.description ?? STATUS_META[ev.status]?.label ?? ev.status}
                  </Body>
                  <Body muted size="xs">
                    {new Date(ev.created_at).toLocaleString()} · {STATUS_META[ev.status]?.label ?? ev.status}
                  </Body>
                </View>
                {i === 0 ? (
                  <Badge style={{ backgroundColor: colors.olive[100] }}>
                    <Label style={{ color: colors.olive[700], fontSize: 9 }}>LATEST</Label>
                  </Badge>
                ) : null}
              </View>
            ))}
        </View>

        <Button
          variant="ghost"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[5] },
  heroCard: {
    backgroundColor: colors.olive[100],
    borderRadius: radii["2xl"],
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  heroTop: { flexDirection: "row", gap: spacing[3], alignItems: "center" },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
  },
  heroKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.olive[800],
    letterSpacing: 1.2,
  },
  heroCopy: { color: colors.olive[800], marginTop: 2 },
  heroFooter: { gap: 2 },
  heroAddress: { color: colors.olive[700] },
  riderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  riderLeft: { flexDirection: "row", gap: spacing[3], alignItems: "center", flex: 1 },
  riderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.light.primary,
  },
  riderCall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  callLabel: {
    color: colors.light.primary,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
  },
  sectionTitle: {},
  timeline: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  timelineRow: { flexDirection: "row", gap: spacing[3], minHeight: 56 },
  timelineRail: { alignItems: "center", width: 24 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineDotDone: { backgroundColor: colors.light.primary },
  timelineDotCurrent: {
    backgroundColor: colors.accent2.ochre,
    borderWidth: 2,
    borderColor: colors.accent2.ochre + "40",
  },
  timelineLine: {
    position: "absolute",
    top: 22,
    bottom: -34,
    width: 2,
    backgroundColor: colors.light.border,
  },
  timelineLineDone: { backgroundColor: colors.light.primary },
  timelineBody: { flex: 1, paddingBottom: spacing[4] },
  timelineLabel: { color: colors.light.mutedForeground },
  timelineLabelDone: { color: colors.light.foreground, fontFamily: fontFamilies.sans.semibold },
  eventsCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  eventRow: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "center",
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[600],
  },
  eventTitle: { fontFamily: fontFamilies.sans.semibold },
});
