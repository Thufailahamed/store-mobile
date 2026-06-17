import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Avatar, Badge, Button, useToast } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { getOrderById, cancelOrder as cancelOrderRpc } from "@/lib/api";
import { canBuyerCancel, CUSTOMER_STATUS_STEPS } from "@/lib/order-lifecycle";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_TONE: Record<OrderStatus, { label: string; bg: string; fg: string; copy: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: "Pending", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, copy: "We've got your order. Confirmation is on the way.", icon: "hourglass-outline" },
  confirmed: { label: "Confirmed", bg: colors.olive[100], fg: colors.olive[700], copy: "Order confirmed and queued with the seller.", icon: "checkmark-circle-outline" },
  processing: { label: "Processing", bg: colors.olive[100], fg: colors.olive[700], copy: "The seller is preparing your pieces.", icon: "construct-outline" },
  shipped: { label: "Shipped", bg: colors.olive[100], fg: colors.olive[700], copy: "Your parcel is moving through the network.", icon: "paper-plane-outline" },
  out_for_delivery: { label: "Out for delivery", bg: colors.olive[200], fg: colors.olive[800], copy: "Rider is on the way. Keep your phone close.", icon: "bicycle-outline" },
  delivered: { label: "Delivered", bg: colors.olive[200], fg: colors.olive[800], copy: "Delivered. Time to unbox and review.", icon: "gift-outline" },
  cancelled: { label: "Cancelled", bg: colors.light.destructive + "20", fg: colors.light.destructive, copy: "This order was cancelled.", icon: "close-circle-outline" },
  returned: { label: "Returned", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, copy: "Items were returned.", icon: "refresh-outline" },
  refunded: { label: "Refunded", bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre, copy: "Refund issued to your original payment.", icon: "card-outline" },
};

const STATUS_STEPS: OrderStatus[] = CUSTOMER_STATUS_STEPS;

const PAYMENT_TONE: Record<string, { bg: string; fg: string }> = {
  paid: { bg: colors.olive[100], fg: colors.olive[700] },
  pending: { bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre },
  failed: { bg: colors.light.destructive + "20", fg: colors.light.destructive },
  refunded: { bg: colors.olive[200], fg: colors.olive[800] },
  partially_refunded: { bg: colors.accent2.ochre + "20", fg: colors.accent2.ochre },
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    const orderId = id as string;
    let cancelled = false;
    getOrderById(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) setOrder(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCancelOrder = async () => {
    if (!order) return;
    Alert.alert("Cancel order", "Are you sure you want to cancel this order? This cannot be undone.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          const res = await cancelOrderRpc(order.id);
          setCancelling(false);
          if (!res.ok) {
            toast(res.error, "error");
            return;
          }
          setOrder({ ...order, status: "cancelled" });
          toast("Order cancelled", "success");
        },
      },
    ]);
  };

  const shareOrder = async () => {
    if (!order) return;
    try {
      await Share.share({
        title: `Order #${order.order_number}`,
        message: `LUXE order #${order.order_number} · ${formatPrice(order.total, order.currency)} · ${order.items?.length ?? 0} items`,
      });
    } catch {}
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Order" />
        <View style={styles.emptyContainer}>
          <Body muted>{loading ? "Loading order…" : "Order not found"}</Body>
        </View>
      </SafeAreaView>
    );
  }

  const tone = STATUS_TONE[order.status] || STATUS_TONE.pending;
  const paymentTone = PAYMENT_TONE[order.payment_status] || PAYMENT_TONE.pending;
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const canCancel = canBuyerCancel(order.status) || order.status === "processing";
  const canReturn = order.status === "delivered";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={`Order #${order.order_number}`}
        right={
          <TouchableOpacity style={styles.shareBtn} onPress={shareOrder}>
            <Ionicons name="share-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status hero */}
        <View style={[styles.statusCard, { backgroundColor: tone.bg }]}>
          <View style={styles.statusIconWrap}>
            <Ionicons name={tone.icon} size={24} color={tone.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Label style={[styles.statusKicker, { color: tone.fg }]}>{tone.label}</Label>
            <Body size="sm" style={{ color: tone.fg, opacity: 0.9, marginTop: 2 }}>{tone.copy}</Body>
          </View>
        </View>

        {/* Progress */}
        {currentStepIndex >= 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Display size="lg">Progress</Display>
              <Body muted size="xs">
                Placed {new Date(order.placed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Body>
            </View>
            <View style={styles.progress}>
              {STATUS_STEPS.map((step, i) => {
                const isDone = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <View key={step} style={styles.progressStep}>
                    <View style={[styles.progressDot, isDone && styles.progressDotDone, isCurrent && styles.progressDotCurrent]}>
                      {isDone && <Ionicons name="checkmark" size={10} color={colors.light.primaryForeground} />}
                    </View>
                    <Label style={[styles.progressLabel, isDone && styles.progressLabelDone]}>
                      {step.replace(/_/g, " ")}
                    </Label>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.progressLine, isDone && styles.progressLineDone]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          {canReturn && (
            <ActionChip
              icon="refresh-outline"
              label="Return"
              onPress={() =>
                router.push({
                  pathname: "/(main)/account/returns/new" as never,
                  params: { orderId: order.id },
                })
              }
            />
          )}
          {order.status === "delivered" && (
            <ActionChip icon="star-outline" label="Review" onPress={() => router.push("/(main)/account/reviews" as never)} />
          )}
          {(order.status === "shipped" ||
            order.status === "out_for_delivery" ||
            order.status === "processing" ||
            order.status === "confirmed") && (
            <ActionChip
              icon="location-outline"
              label="Track"
              onPress={() =>
                router.push({
                  pathname: "/(main)/account/orders/[id]/track" as never,
                  params: { id: order.id },
                })
              }
            />
          )}
          <ActionChip icon="document-text-outline" label="Invoice" onPress={shareOrder} />
          {canCancel && (
            <ActionChip icon="close-circle-outline" label="Cancel" danger onPress={handleCancelOrder} />
          )}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Items</Display>
          {order.items?.map((item) => {
            const img = item.product?.images?.find((i) => i.is_primary)?.url ?? item.product?.images?.[0]?.url;
            return (
              <View key={item.id} style={styles.itemRow}>
                {img ? (
                  <Avatar uri={img} size={56} style={{ borderRadius: radii.lg }} />
                ) : (
                  <View style={styles.itemPlaceholder}>
                    <Ionicons name="cube-outline" size={20} color={colors.light.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Body size="sm" numberOfLines={2} style={styles.itemName}>{item.product_name}</Body>
                  {item.variant_label && <Body muted size="xs">{item.variant_label}</Body>}
                  <Body muted size="xs">Qty {item.quantity} · Unit {formatPrice(item.unit_price, order.currency)}</Body>
                </View>
                <Price style={styles.itemTotal}>{formatPrice(item.total, order.currency)}</Price>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Summary</Display>
          <View style={styles.summaryRow}>
            <Body muted>Subtotal</Body>
            <Body size="sm">{formatPrice(order.subtotal, order.currency)}</Body>
          </View>
          <View style={styles.summaryRow}>
            <Body muted>Shipping</Body>
            <Body size="sm" style={order.shipping_fee === 0 ? { color: colors.olive[600] } : undefined}>
              {order.shipping_fee === 0 ? "FREE" : formatPrice(order.shipping_fee, order.currency)}
            </Body>
          </View>
          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Body muted>Discount</Body>
              <Body size="sm" style={{ color: colors.olive[600] }}>-{formatPrice(order.discount, order.currency)}</Body>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Body muted>Tax</Body>
            <Body size="sm">{formatPrice(order.tax, order.currency)}</Body>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Label style={styles.totalLabel}>Total</Label>
            <Price style={styles.totalValue}>{formatPrice(order.total, order.currency)}</Price>
          </View>
        </View>

        {/* Shipping address */}
        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Shipping address</Display>
          <View style={styles.addressCard}>
            <View style={styles.addressIcon}>
              <Ionicons name="location-outline" size={18} color={colors.light.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Body size="sm" style={styles.addressName}>
                {order.address?.full_name || order.shipping_address?.full_name}
              </Body>
              <Body muted size="xs">
                {order.address?.line1 || order.shipping_address?.line1}
                {(order.address?.line2 || order.shipping_address?.line2) ? `, ${order.address?.line2 || order.shipping_address?.line2}` : ""}
              </Body>
              <Body muted size="xs">
                {order.address?.city || order.shipping_address?.city}, {order.address?.state || order.shipping_address?.state} {order.address?.postal_code || order.shipping_address?.postal_code}
              </Body>
              <Body muted size="xs">{order.address?.phone || order.shipping_address?.phone}</Body>
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Payment</Display>
          <View style={styles.summaryRow}>
            <Body muted>Method</Body>
            <Body size="sm" style={styles.paymentMethod}>
              <Ionicons name={order.payment_method === "cod" ? "cash-outline" : "card-outline"} size={14} color={colors.light.foreground} />
              {" "}{(order.payment_method ?? "card").toUpperCase()}
            </Body>
          </View>
          <View style={styles.summaryRow}>
            <Body muted>Status</Body>
            <Badge style={{ backgroundColor: paymentTone.bg }}>
              <Label style={{ color: paymentTone.fg, fontSize: 10 }}>{order.payment_status?.toUpperCase()}</Label>
            </Badge>
          </View>
        </View>

        {cancelling && (
          <View style={styles.overlay}><Body muted>Cancelling…</Body></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionChip({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionChip, danger && styles.actionChipDanger]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={14} color={danger ? colors.light.destructive : colors.light.foreground} />
      <Label style={[styles.actionChipText, danger && { color: colors.light.destructive }]}>{label}</Label>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii["2xl"],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: typography.fontSizes.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing[3] },
  cardTitle: { marginBottom: spacing[3] },
  progress: { flexDirection: "row", justifyContent: "space-between", position: "relative", paddingTop: 4 },
  progressStep: { alignItems: "center", flex: 1, position: "relative" },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  progressDotDone: { backgroundColor: colors.light.primary },
  progressDotCurrent: { backgroundColor: colors.accent2.ochre },
  progressLabel: {
    fontSize: 8,
    color: colors.light.mutedForeground,
    marginTop: 6,
    textAlign: "center",
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  progressLabelDone: { color: colors.light.foreground, fontWeight: typography.fontWeights.medium },
  progressLine: {
    position: "absolute",
    top: 11,
    left: "50%",
    right: "-50%",
    height: 2,
    backgroundColor: colors.light.border,
    zIndex: 1,
  },
  progressLineDone: { backgroundColor: colors.light.primary },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing[3],
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actionChipDanger: { borderColor: colors.light.destructive + "40" },
  actionChipText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  itemPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { fontWeight: typography.fontWeights.medium },
  itemTotal: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.sm, color: colors.olive[800] },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  totalValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.olive[800],
  },
  addressCard: {
    flexDirection: "row",
    gap: spacing[3],
    backgroundColor: colors.olive[50] + "60",
    borderRadius: radii.xl,
    padding: spacing[3],
    alignItems: "flex-start",
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  addressName: { fontWeight: typography.fontWeights.semibold, marginBottom: 2 },
  paymentMethod: { fontFamily: fontFamilies.mono.medium },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
});
