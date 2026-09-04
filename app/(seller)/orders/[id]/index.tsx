import React, { useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getSellerStore, getSellerOrderById, transitionOrderStatus } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { CUSTOMER_STATUS_STEPS, getSellerNextStatus } from "@/lib/order-lifecycle";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#fef3c7", text: "#92400e" },
  out_for_delivery: { bg: "#f3e8ff", text: "#7c3aed" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
  returned: { bg: "#f3e8ff", text: "#7c3aed" },
  refunded: { bg: "#fce7f3", text: "#be185d" },
};

const STATUSES: OrderStatus[] = CUSTOMER_STATUS_STEPS;

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoading(false);
        return;
      }
      const res = await getSellerOrderById(id, storeRes.data.id);
      if (res.ok && res.data) setOrder(res.data);
      setLoading(false);
    })();
  }, [id, user]);

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
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <Text style={styles.loadingText}>Order not found</Text>
      </SafeAreaView>
    );
  }

  const canRefund = order.status === "delivered" || order.status === "processing";

  const nextStatus = getSellerNextStatus(order.status);
  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
  const itemsCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const ship = order.shipping_address;
  const statusIndex = STATUSES.indexOf(order.status as OrderStatus);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Text style={styles.orderDate}>{formatDate(order.placed_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{order.status}</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          {STATUSES.map((s, i) => {
            const isActive = i <= statusIndex && statusIndex >= 0;
            return (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  isActive && styles.progressDotActive,
                  i === statusIndex && styles.progressDotCurrent,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.progressLabels}>
          {STATUSES.map((s, i) => (
            <Text
              key={s}
              style={[
                styles.progressLabel,
                i <= statusIndex && statusIndex >= 0 && styles.progressLabelActive,
              ]}
              numberOfLines={1}
            >
              {s.replace(/_/g, " ")}
            </Text>
          ))}
        </View>
      </View>

      {/* Status Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.bannerStatus}>{order.status.replace(/_/g, " ")}</Text>
            <Text style={styles.bannerPayment}>
              {order.payment_status === "paid" ? "✅ Paid" : "⏳ Payment pending"}
            </Text>
          </View>
          <View style={styles.bannerRight}>
            <Text style={styles.bannerTotal}>{formatPrice(order.total)}</Text>
            <Text style={styles.bannerMethod}>{order.payment_method?.toUpperCase() ?? "—"}</Text>
          </View>
        </View>
      </View>

      {/* Next Action */}
      {nextStatus && (
        <TouchableOpacity
          style={[styles.actionButton, updating && { opacity: 0.6 }]}
          onPress={() => handleTransition(nextStatus)}
          disabled={updating}
        >
          <Text style={styles.actionButtonText}>
            {updating ? "Updating..." : `Mark as ${nextStatus.replace(/_/g, " ")}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Refund — destructive secondary action, shown for delivered/processing */}
      {canRefund && (
        <TouchableOpacity
          style={[styles.refundButton, updating && { opacity: 0.6 }]}
          onPress={openRefundDialog}
          disabled={updating}
          accessibilityLabel="Refund order"
        >
          <Text style={styles.refundButtonText}>
            {updating ? "Updating..." : "Refund order"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({itemsCount})</Text>
        {order.items?.map((item) => (
          <View key={item.id} style={styles.itemCard}>
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
        <Text style={styles.sectionTitle}>Your items total</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} bold />
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
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: colors.light.mutedForeground },

  header: { marginBottom: 16 },
  backButton: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    fontFamily: "monospace",
  },
  orderDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },

  progressSection: { marginBottom: 20 },
  progressTrack: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.muted,
  },
  progressDotActive: { backgroundColor: colors.light.primary },
  progressDotCurrent: {
    backgroundColor: colors.light.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: -2,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 8,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
    width: 52,
    textAlign: "center",
  },
  progressLabelActive: { color: colors.light.primary, fontWeight: typography.fontWeights.semibold as any },

  banner: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 12,
  },
  bannerRow: { flexDirection: "row", justifyContent: "space-between" },
  bannerStatus: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    textTransform: "capitalize",
  },
  bannerPayment: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  bannerRight: { alignItems: "flex-end" },
  bannerTotal: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  bannerMethod: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  actionButton: {
    backgroundColor: colors.light.primary,
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginBottom: 12,
  },
  actionButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    textTransform: "capitalize",
  },

  refundButton: {
    backgroundColor: "#fef2f2",
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 20,
  },
  refundButtonText: {
    color: "#dc2626",
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 18,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 6,
  },
  modalBody: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginBottom: 12,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  modalBtnCancel: {
    backgroundColor: colors.light.muted,
  },
  modalBtnCancelText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
  },
  modalBtnConfirm: {
    backgroundColor: "#dc2626",
  },
  modalBtnConfirmText: {
    color: "#fff",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 10,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    marginBottom: 8,
  },
  itemName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  itemVariant: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
    textTransform: "capitalize",
  },
  itemQty: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },

  summaryCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  summaryLabelBold: { fontWeight: typography.fontWeights.bold as any, color: colors.light.foreground },
  summaryValue: { fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  summaryValueBold: { fontWeight: typography.fontWeights.bold as any },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginVertical: 8,
  },

  addressCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  addressName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  addressPhone: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  addressLine: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    marginTop: 4,
  },

  notesCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  notesText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    lineHeight: 20,
  },
});
