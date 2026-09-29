import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  RefreshControl,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { getSellerStore, getSellerOrderById, transitionOrderStatus, cancelOrder } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { canSellerCancelOrder } from "@/lib/order-lifecycle";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { CUSTOMER_STATUS_STEPS, getSellerNextStatus } from "@/lib/order-lifecycle";
import { formatCheckoutPayment, formatOrderStatusLabel, formatPaymentStatus } from "@/lib/orders/seller-list";
import { orderStatusTone } from "@/lib/seller/status-tones";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { Skeleton, SkeletonListRow } from "@/components/ui/Skeleton";
import type { Order, OrderStatus } from "@/lib/types";

const STATUSES: OrderStatus[] = CUSTOMER_STATUS_STEPS;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const load = useCallback(async () => {
    if (!id || !user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok || !storeRes.data) {
      setLoadError(storeRes.ok ? "No store found" : storeRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getSellerOrderById(id, storeRes.data.id);
    if (res.ok && res.data) {
      setOrder(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.ok ? "Order not found" : res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    load();
  }, [load]);

  const handleTransition = async (nextStatus: OrderStatus) => {
    if (!order) return;
    const label = nextStatus.replace(/_/g, " ");
    Alert.alert(
      "Update status?",
      `Mark order as "${label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setUpdating(true);
            const res = await transitionOrderStatus(order.id, nextStatus);
            setUpdating(false);
            if (res.ok) {
              setOrder({ ...order, status: res.data.status as OrderStatus });
            } else {
              Alert.alert("Error", res.error);
            }
          },
        },
      ]
    );
  };

  const handleCancel = useCallback(() => {
    if (!order || updating) return;
    Alert.alert("Cancel order?", `Cancel ${order.order_number}? Stock will be restored.`, [
      { text: "Keep", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: async () => {
        setUpdating(true);
        const res = await cancelOrder(order.id);
        setUpdating(false);
        if (res.ok) {
          setOrder({ ...order, status: "cancelled" });
        } else {
          Alert.alert("Error", res.error);
        }
      } },
    ]);
  }, [order, updating]);

  /**
   * Issue a refund for a delivered/processing order. Mirrors web's admin
   * force_refund flow: seller transitions the order to `refunded` via the
   * existing /api/orders/:id/transition endpoint with a reason. The
   * backend's transition_order_status RPC + ORDER_STATUS_EDGES allow
   * delivered→refunded and (admin) processing→refunded.
   */
  const openRefundDialog = () => setRefundModalOpen(true);
  const closeRefundDialog = () => {
    setRefundModalOpen(false);
    setRefundReason("");
  };

  const submitRefund = async () => {
    if (!order) return;
    const reason = refundReason.trim() || "Seller refund";
    setUpdating(true);
    const res = await transitionOrderStatus(order.id, "refunded", { reason });
    setUpdating(false);
    closeRefundDialog();
    if (res.ok) {
      setOrder({ ...order, status: res.data.status as OrderStatus });
      Alert.alert("Refunded", "The order has been marked as refunded.");
    } else {
      Alert.alert("Refund failed", res.error);
    }
  };

  // Refund is shown when the order is in a state the seller can transition
  // out of (delivered, or processing under admin override per
  // ORDER_STATUS_EDGES).

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <SellerBackButton label="Orders" fallbackHref="/(seller)/orders" />
          <View style={styles.skeletonHeader}>
            <Skeleton width="48%" height={28} borderRadius={8} />
            <Skeleton width="32%" height={14} borderRadius={6} />
            <Skeleton width={88} height={28} borderRadius={radii.full} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.skeletonCard}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="70%" height={18} style={{ marginTop: 10 }} />
            <Skeleton width="55%" height={14} style={{ marginTop: 8 }} />
          </View>
          <View style={styles.skeletonCard}>
            <Skeleton width="100%" height={44} borderRadius={radii.lg} />
          </View>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    const friendlyError =
      !loadError
        ? "Order not found"
        : /more than one relationship|upstream:|PGRST/i.test(loadError)
          ? "Something went wrong loading this order. Please try again."
          : loadError;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <SellerBackButton label="Orders" fallbackHref="/(seller)/orders" />
          <View style={styles.errorPanel}>
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Couldn’t load this order</Text>
            <Text style={styles.errorBody}>{friendlyError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryLabel}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const canRefund = order.status === "delivered" || order.status === "processing";
  const canCancel = canSellerCancelOrder(order.status);
  const nextStatus = getSellerNextStatus(order.status);
  const sc = orderStatusTone(order.status);
  const itemsCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const ship = order.shipping_address;
  const statusIndex = STATUSES.indexOf(order.status as OrderStatus);
  // cancelled / refunded / returned are not points on the fulfilment
  // track, so a step bar with nothing highlighted would just look broken.
  const isTerminal = statusIndex < 0;
  const isPaid = order.payment_status === "paid";
  const codUnpaid = order.payment_method === "cod" && !isPaid;
  // Destructive actions live behind the "…" menu so the bottom bar only
  // carries the next fulfilment step. Refund surfaces in the bar itself
  // once there is no next step (e.g. delivered).
  const hasMoreActions = canCancel || (canRefund && !!nextStatus);
  const showActionBar = !!nextStatus || canRefund;

  const openMoreActions = () => {
    const options: { label: string; run: () => void }[] = [];
    if (canRefund && nextStatus) options.push({ label: "Refund order", run: openRefundDialog });
    if (canCancel) options.push({ label: "Cancel order", run: handleCancel });
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), "Close"],
          destructiveButtonIndex: options.map((_, i) => i),
          cancelButtonIndex: options.length,
          title: order.order_number,
        },
        (index) => options[index]?.run(),
      );
    } else {
      Alert.alert(order.order_number, undefined, [
        ...options.map((o) => ({ text: o.label, style: "destructive" as const, onPress: o.run })),
        { text: "Close", style: "cancel" as const },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
    <View style={styles.header}>
      <SellerBackButton label="Orders" fallbackHref="/(seller)/orders" />
      {hasMoreActions ? (
        <TouchableOpacity
          style={styles.moreButton}
          onPress={openMoreActions}
          disabled={updating}
          accessibilityRole="button"
          accessibilityLabel="More order actions"
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.olive[900]} />
        </TouchableOpacity>
      ) : null}
    </View>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: showActionBar ? 110 : 32 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />
      }
    >
      <View style={styles.orderHero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroStatus}>
            <View style={[styles.heroStatusDot, isTerminal && styles.heroStatusDotMuted]} />
            <Text style={styles.heroStatusText}>{formatOrderStatusLabel(order.status)}</Text>
          </View>
          <Text style={styles.orderDate} numberOfLines={1}>{formatDate(order.placed_at)}</Text>
        </View>
        <Text style={styles.orderNumber} numberOfLines={1} adjustsFontSizeToFit>{order.order_number}</Text>
        <View style={styles.heroFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroMetaLabel}>ORDER TOTAL · {itemsCount} {itemsCount === 1 ? "ITEM" : "ITEMS"}</Text>
            <Text style={styles.heroTotal}>{formatPrice(order.total)}</Text>
          </View>
          <View style={[styles.heroPayment, codUnpaid && styles.heroPaymentWarn]}>
            <Ionicons
              name={isPaid ? "checkmark-circle" : "time-outline"}
              size={15}
              color={codUnpaid ? "#FFB89E" : "#E8CF8F"}
            />
            <Text style={[styles.heroPaymentText, codUnpaid && styles.heroPaymentTextWarn]}>
              {formatCheckoutPayment(order.payment_method)} · {formatPaymentStatus(order.payment_status)}
            </Text>
          </View>
        </View>

        {!isTerminal ? (
          <View style={styles.stepper}>
            {STATUSES.map((step, i) => {
              const done = i < statusIndex;
              const current = i === statusIndex;
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepTrackRow}>
                    <View style={[styles.stepLine, i === 0 && styles.stepLineHidden, (done || current) && i > 0 && styles.stepLineDone]} />
                    <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                      {done ? <Ionicons name="checkmark" size={10} color="#1A1915" /> : null}
                    </View>
                    <View style={[styles.stepLine, i === STATUSES.length - 1 && styles.stepLineHidden, done && styles.stepLineDone]} />
                  </View>
                  <Text
                    style={[styles.stepLabel, done && styles.stepLabelActive, current && styles.stepLabelCurrent]}
                    numberOfLines={2}
                  >
                    {formatOrderStatusLabel(step)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {isTerminal ? (
        <View style={[styles.terminalNotice, { backgroundColor: sc.bg }]}>
          <Ionicons name="information-circle-outline" size={18} color={sc.text} />
          <Text style={[styles.terminalNoticeText, { color: sc.text }]}>This order is {formatOrderStatusLabel(order.status).toLowerCase()} and fulfilment has stopped.</Text>
        </View>
      ) : null}

      {codUnpaid ? (
        <View style={styles.codBanner}>
          <Ionicons name="cash-outline" size={18} color={colors.accent2.rust} />
          <View style={{ flex: 1 }}>
            <Text style={styles.codTitle}>Collect {formatPrice(order.total)} on delivery</Text>
            <Text style={styles.codBody}>Once cash is collected, the order can be marked through its status flow.</Text>
          </View>
        </View>
      ) : null}

      {ship ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>SHIP TO</Text>
          <View style={styles.card}>
            <View style={styles.customerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(ship.full_name?.trim()?.[0] ?? "?").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.addressName} numberOfLines={1}>{ship.full_name || "Customer"}</Text>
                {ship.phone ? <Text style={styles.addressPhone}>{ship.phone}</Text> : null}
              </View>
              {ship.phone ? (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => void Linking.openURL(`tel:${ship.phone.replace(/[^+\d]/g, "")}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${ship.full_name || "customer"}`}
                >
                  <Ionicons name="call-outline" size={17} color={colors.olive[900]} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color={colors.ink.mute} style={{ marginTop: 2 }} />
              <Text style={styles.addressLine}>
                {[ship.line1, ship.line2, [ship.city, ship.state, ship.postal_code].filter(Boolean).join(", "), ship.country]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {order.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>CUSTOMER NOTE</Text>
          <View style={[styles.card, styles.notesCard]}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.olive[700]} style={{ marginTop: 2 }} />
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>ITEMS · {itemsCount} {itemsCount === 1 ? "UNIT" : "UNITS"}</Text>
        <View style={styles.card}>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.itemThumb, styles.itemThumbEmpty]}><Ionicons name="image-outline" size={20} color={colors.ink.mute} /></View>
                )}
                {item.quantity > 1 ? (
                  <View style={styles.qtyBadge}><Text style={styles.qtyBadgeText}>×{item.quantity}</Text></View>
                ) : null}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
                {item.variant_label ? <Text style={styles.itemVariant}>{item.variant_label}</Text> : null}
                <Text style={styles.itemUnitPrice}>
                  {item.quantity} × {formatPrice(item.total / Math.max(1, item.quantity))}
                </Text>
              </View>
              <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
            </View>
          ))}

          <View style={styles.cardDivider} />
          <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
          <SummaryRow label="Shipping" value={order.shipping_fee > 0 ? formatPrice(order.shipping_fee) : "Free"} />
          {order.tax > 0 ? <SummaryRow label="Tax" value={formatPrice(order.tax)} /> : null}
          {order.discount > 0 ? <SummaryRow label="Discount" value={`−${formatPrice(order.discount)}`} accent /> : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>

    {/* Refund modal — cross-platform reason input + confirm */}
    <Modal
      visible={refundModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeRefundDialog}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Refund order</Text>
          <Text style={styles.modalBody}>
            This marks the order as refunded and notifies the buyer. Add an optional reason for the audit log:
          </Text>
          <TextInput
            style={styles.modalInput}
            value={refundReason}
            onChangeText={setRefundReason}
            placeholder="e.g. Customer reported defect"
            placeholderTextColor={colors.light.mutedForeground}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={closeRefundDialog}
              disabled={updating}
            >
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnConfirm, updating && { opacity: 0.6 }]}
              onPress={submitRefund}
              disabled={updating}
            >
              <Text style={styles.modalBtnConfirmText}>
                {updating ? "Refunding..." : "Refund"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    {showActionBar ? (
      <View style={styles.actionBar}>
        {nextStatus ? (
          <TouchableOpacity
            style={[styles.primaryAction, updating && styles.actionDisabled]}
            onPress={() => handleTransition(nextStatus)}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
          >
            <Text style={styles.primaryActionText}>{updating ? "Working…" : `Mark as ${formatOrderStatusLabel(nextStatus).toLowerCase()}`}</Text>
            {updating ? null : <Ionicons name="arrow-forward" size={17} color={CREAM} />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.refundAction, updating && styles.actionDisabled]}
            onPress={openRefundDialog}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel="Refund order"
          >
            <Ionicons name="return-down-back-outline" size={17} color={colors.accent2.rust} />
            <Text style={styles.refundActionText}>Refund order</Text>
          </TouchableOpacity>
        )}
      </View>
    ) : null}
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  skeletonHeader: { gap: 10, marginTop: 8, marginBottom: 16 },
  skeletonCard: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    padding: 16,
    marginBottom: 12,
  },

  errorPanel: {
    marginTop: 24,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 8,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorIconText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.olive[700],
  },
  errorTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: INK,
    textAlign: "center",
  },
  errorBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  retryLabel: {
    fontFamily: fontFamilies.sans.semibold,
    color: CREAM,
    fontSize: typography.fontSizes.sm,
  },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  moreButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(83,94,44,0.14)", alignItems: "center", justifyContent: "center" },

  orderHero: { backgroundColor: "#1A1915", borderRadius: 26, padding: 20, marginBottom: 14 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.full, backgroundColor: "rgba(232,207,143,0.14)" },
  heroStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E8CF8F" },
  heroStatusDotMuted: { backgroundColor: "#8F897D" },
  heroStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#F1E4BF" },
  orderDate: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "#AAA396" },
  orderNumber: { marginTop: 16, fontFamily: fontFamilies.mono.semibold, fontSize: 20, color: "#FAF8F1", letterSpacing: -0.2 },
  heroFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 14 },
  heroMetaLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1, color: "#8F897D" },
  heroTotal: { marginTop: 4, fontFamily: fontFamilies.display.semibold, fontSize: 32, lineHeight: 38, color: "#FAF8F1", fontVariant: ["tabular-nums"] },
  heroPayment: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radii.full, backgroundColor: "rgba(232,207,143,0.12)", marginBottom: 4 },
  heroPaymentWarn: { backgroundColor: "rgba(184,92,58,0.22)" },
  heroPaymentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#E8CF8F" },
  heroPaymentTextWarn: { color: "#FFB89E" },

  stepper: { flexDirection: "row", marginTop: 20, paddingTop: 18, marginHorizontal: -6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.13)" },
  step: { flex: 1, alignItems: "center", gap: 8 },
  stepTrackRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  stepLine: { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.12)" },
  stepLineDone: { backgroundColor: "#E8CF8F" },
  stepLineHidden: { backgroundColor: "transparent" },
  stepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "#1A1915", alignItems: "center", justifyContent: "center" },
  stepDotDone: { borderColor: "#E8CF8F", backgroundColor: "#E8CF8F" },
  stepDotCurrent: { width: 18, height: 18, borderRadius: 9, borderWidth: 5, borderColor: "#E8CF8F", backgroundColor: "#1A1915" },
  stepLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 10, lineHeight: 13, color: "#6F6A60", textAlign: "center", paddingHorizontal: 2 },
  stepLabelActive: { color: "#AAA396" },
  stepLabelCurrent: { fontFamily: fontFamilies.sans.semibold, color: "#F1E4BF" },

  terminalNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(83,94,44,0.08)" },
  terminalNoticeText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, lineHeight: 19 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: INK,
    marginBottom: 6,
  },
  modalBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginBottom: 12,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    backgroundColor: CREAM,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    padding: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  modalBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancel: {
    backgroundColor: colors.olive[50],
  },
  modalBtnCancelText: {
    fontFamily: fontFamilies.sans.medium,
    color: INK,
    fontSize: typography.fontSizes.sm,
  },
  modalBtnConfirm: {
    backgroundColor: colors.accent2.rust,
  },
  modalBtnConfirmText: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#fff",
    fontSize: typography.fontSizes.sm,
  },

  section: { marginTop: 22 },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.3, color: colors.olive[600], marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", padding: 16 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.14)", marginVertical: 14 },

  codBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(184,92,58,0.08)", borderWidth: 1, borderColor: "rgba(184,92,58,0.24)", borderRadius: 18, padding: 14 },
  codTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.accent2.rust },
  codBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 3, lineHeight: 17 },

  customerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: CREAM },
  addressName: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK },
  addressPhone: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, marginTop: 2 },
  callButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  addressRow: { flexDirection: "row", gap: 10 },
  addressLine: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: INK },

  notesCard: { flexDirection: "row", gap: 10, backgroundColor: colors.olive[50] },
  notesText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: INK },

  itemCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  itemThumb: { width: 60, height: 60, borderRadius: 15, backgroundColor: colors.olive[50] },
  itemThumbEmpty: { alignItems: "center", justifyContent: "center" },
  qtyBadge: { position: "absolute", right: -5, top: -5, minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: INK, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  qtyBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: CREAM },
  itemInfo: { flex: 1, minWidth: 0, gap: 3 },
  itemName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, lineHeight: 19, color: INK },
  itemVariant: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, textTransform: "capitalize" },
  itemUnitPrice: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  itemPrice: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  summaryLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: colors.light.mutedForeground },
  summaryValue: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },
  summaryValueAccent: { color: colors.olive[700] },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
  totalLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK },
  totalValue: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: INK, fontVariant: ["tabular-nums"] },

  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(250,249,245,0.97)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
  primaryAction: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.full, backgroundColor: colors.olive[900], paddingHorizontal: 20 },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: CREAM },
  refundAction: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.full, borderWidth: 1, borderColor: "rgba(184,92,58,0.3)", backgroundColor: "rgba(184,92,58,0.05)" },
  refundActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: colors.accent2.rust },
  actionDisabled: { opacity: 0.6 },
});
