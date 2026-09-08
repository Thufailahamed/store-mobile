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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
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
import {
  SellerStickyBar,
  SellerPrimaryButton,
  SellerGhostButton,
  SellerStatusPill,
} from "@/components/seller/chrome";
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

  const nextStatus = getSellerNextStatus(order.status);
  const sc = orderStatusTone(order.status);
  const itemsCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const ship = order.shipping_address;
  const statusIndex = STATUSES.indexOf(order.status as OrderStatus);
  // cancelled / refunded / returned are not points on the fulfilment
  // track, so a step bar with nothing highlighted would just look broken.
  const isTerminal = statusIndex < 0;
  const completedCount = statusIndex >= 0 ? statusIndex : 0;
  const nextOnTrack =
    statusIndex >= 0 && statusIndex < STATUSES.length - 1
      ? STATUSES[statusIndex + 1]
      : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: nextStatus || canRefund || canSellerCancelOrder(order.status) ? 120 : 32 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <SellerBackButton label="Orders" fallbackHref="/(seller)/orders" />
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Text style={styles.orderDate}>{formatDate(order.placed_at)}</Text>
          </View>
          <SellerStatusPill
            label={formatOrderStatusLabel(order.status)}
            bg={sc.bg}
            color={sc.text}
            dotted={order.status === "pending" || order.status === "processing"}
          />
        </View>
      </View>

      {/* Compact vertical stepper — current + next only */}
      {isTerminal ? (
        <View style={[styles.terminalNotice, { backgroundColor: sc.bg }]}>
          <Text style={[styles.terminalNoticeText, { color: sc.text }]}>
            This order is {formatOrderStatusLabel(order.status).toLowerCase()} — fulfilment has
            stopped.
          </Text>
        </View>
      ) : (
        <View style={styles.stepperCard}>
          <Text style={styles.stepperMeta}>
            {completedCount} of {STATUSES.length} steps complete
          </Text>
          <View style={styles.stepperRow}>
            <View style={styles.stepperRail}>
              <View style={[styles.stepDot, styles.stepDotCurrent]} />
              {nextOnTrack ? <View style={styles.stepConnector} /> : null}
              {nextOnTrack ? <View style={styles.stepDot} /> : null}
            </View>
            <View style={styles.stepperLabels}>
              <View style={styles.stepLabelBlock}>
                <Text style={styles.stepLabelKicker}>Current</Text>
                <Text style={styles.stepLabelCurrent}>
                  {formatOrderStatusLabel(order.status)}
                </Text>
              </View>
              {nextOnTrack ? (
                <View style={styles.stepLabelBlock}>
                  <Text style={styles.stepLabelKicker}>Next</Text>
                  <Text style={styles.stepLabelNext}>
                    {formatOrderStatusLabel(nextOnTrack)}
                  </Text>
                </View>
              ) : (
                <View style={styles.stepLabelBlock}>
                  <Text style={styles.stepLabelKicker}>Next</Text>
                  <Text style={styles.stepLabelNext}>Fulfilment complete</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Status Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.bannerStatus}>{formatOrderStatusLabel(order.status)}</Text>
            <Text style={styles.bannerPayment}>
              {formatPaymentStatus(order.payment_status)}
            </Text>
          </View>
          <View style={styles.bannerRight}>
            <Text style={styles.bannerTotal}>{formatPrice(order.total)}</Text>
            <Text style={styles.bannerMethod}>{formatCheckoutPayment(order.payment_method)}</Text>
          </View>
        </View>
      </View>

      {/* COD collect reminder */}
      {order.payment_method === "cod" && order.payment_status !== "paid" ? (
        <View style={styles.codBanner}>
          <Text style={styles.codTitle}>Collect {formatPrice(order.total)} on delivery</Text>
          <Text style={styles.codBody}>Once cash is collected, the order can be marked through its status flow.</Text>
        </View>
      ) : null}

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({itemsCount})</Text>
        {order.items?.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.itemThumb} contentFit="cover" />
            ) : (
              <View style={[styles.itemThumb, styles.itemThumbEmpty]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
              {item.variant_label && (
                <Text style={styles.itemVariant}>{item.variant_label}</Text>
              )}
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price breakdown</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
          <SummaryRow label="Shipping" value={formatPrice(order.shipping_fee)} />
          <SummaryRow label="Tax" value={formatPrice(order.tax)} />
          {order.discount > 0 ? <SummaryRow label="Discount" value={`-${formatPrice(order.discount)}`} /> : null}
          <SummaryRow label="Total" value={formatPrice(order.total)} bold />
          <SummaryRow label="Payment" value={`${formatCheckoutPayment(order.payment_method)} · ${formatPaymentStatus(order.payment_status)}`} />
        </View>
      </View>

      {/* Shipping Address */}
      {ship && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <View style={styles.addressCard}>
            <Text style={styles.addressName}>{ship.full_name}</Text>
            <Text style={styles.addressPhone}>{ship.phone}</Text>
            <Text style={styles.addressLine}>{ship.line1}</Text>
            {ship.line2 && <Text style={styles.addressLine}>{ship.line2}</Text>}
            <Text style={styles.addressLine}>
              {ship.city}, {ship.state} {ship.postal_code}
            </Text>
            <Text style={styles.addressLine}>{ship.country}</Text>
          </View>
        </View>
      )}

      {/* Notes */}
      {order.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
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
    {(nextStatus || canRefund || canSellerCancelOrder(order.status)) && (
      <SellerStickyBar>
        {canSellerCancelOrder(order.status) ? (
          <SellerGhostButton
            label={updating ? "Working…" : "Cancel"}
            onPress={handleCancel}
            disabled={updating}
            danger
            style={{ minWidth: 96 }}
          />
        ) : null}        {canRefund && !nextStatus ? (
          <SellerGhostButton
            label={updating ? "Working…" : "Refund order"}
            onPress={openRefundDialog}
            disabled={updating}
            danger
            style={{ flex: 1 }}
          />
        ) : null}
        {canRefund && nextStatus ? (
          <SellerGhostButton
            label="Refund"
            onPress={openRefundDialog}
            disabled={updating}
            danger
            style={{ minWidth: 96 }}
          />
        ) : null}
        {nextStatus ? (
          <SellerPrimaryButton
            label={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
            onPress={() => handleTransition(nextStatus)}
            disabled={updating}
            loading={updating}
          />
        ) : null}
      </SellerStickyBar>
    )}
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { padding: 16 },

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

  terminalNotice: {
    padding: 14,
    borderRadius: radii.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
  },
  terminalNoticeText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
  },

  header: { marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
  },
  orderNumber: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.3,
  },
  orderDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  statusText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    textTransform: "capitalize",
  },

  stepperCard: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 16,
    marginBottom: 16,
  },
  stepperMeta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  stepperRow: { flexDirection: "row", gap: 14 },
  stepperRail: { alignItems: "center", width: 16, paddingTop: 4 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(83,94,44,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(83,94,44,0.22)",
  },
  stepDotCurrent: {
    backgroundColor: colors.olive[700],
    borderColor: colors.olive[700],
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "rgba(83,94,44,0.18)",
    marginVertical: 4,
  },
  stepperLabels: { flex: 1, gap: 18 },
  stepLabelBlock: { minHeight: 36, justifyContent: "center" },
  stepLabelKicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: colors.olive[700],
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stepLabelCurrent: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.base,
    color: INK,
    textTransform: "capitalize",
  },
  stepLabelNext: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
  },

  banner: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 16,
    marginBottom: 12,
  },
  bannerRow: { flexDirection: "row", justifyContent: "space-between" },
  bannerStatus: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.base,
    color: INK,
    textTransform: "capitalize",
  },
  bannerPayment: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  bannerRight: { alignItems: "flex-end" },
  bannerTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: INK,
    letterSpacing: -0.4,
  },
  bannerMethod: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  actionButton: {
    backgroundColor: colors.olive[700],
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionButtonText: {
    fontFamily: fontFamilies.sans.bold,
    color: CREAM,
    fontSize: typography.fontSizes.base,
    textTransform: "capitalize",
  },

  refundButton: {
    backgroundColor: "rgba(184,92,58,0.08)",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.28)",
    marginBottom: 20,
  },
  refundButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.accent2.rust,
    fontSize: typography.fontSizes.base,
  },

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

  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: INK,
    marginBottom: 10,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 12,
    marginBottom: 8,
  },
  itemThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.olive[50] },
  itemThumbEmpty: { alignItems: "center", justifyContent: "center" },
  codBanner: {
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.28)",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
  },
  codTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.accent2.rust,
  },
  codBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  itemName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  itemVariant: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
    textTransform: "capitalize",
  },
  itemQty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },

  summaryCard: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  summaryLabelBold: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  summaryValue: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  summaryValueBold: {
    fontFamily: fontFamilies.mono.semibold,
  },

  addressCard: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
  },
  addressName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  addressPhone: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  addressLine: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    marginTop: 4,
  },

  notesCard: {
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
  },
  notesText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    lineHeight: 20,
  },
});
