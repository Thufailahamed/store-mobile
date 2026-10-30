import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,

  KeyboardAvoidingView,
  Platform,
  TextInput,
  RefreshControl,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
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
import { HERO, LuxeHero } from "@/components/seller/luxe";
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
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [copied, setCopied] = useState(false);

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
  // Sellers see their products only — buyer-side fees and delivery stay off this screen.
  const itemsTotal = order.items?.reduce((s, i) => s + i.total, 0) ?? 0;
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

  const copyOrderNumber = async () => {
    if (!order.order_number) return;
    await Clipboard.setStringAsync(order.order_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

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
      <LuxeHero style={styles.orderHero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroStatus}>
            <View style={[styles.heroStatusDot, isTerminal && styles.heroStatusDotMuted]} />
            <Text style={styles.heroStatusText}>{formatOrderStatusLabel(order.status)}</Text>
          </View>
          <Text style={styles.orderDate} numberOfLines={1}>{formatDate(order.placed_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.orderNumberRow}
          onPress={() => void copyOrderNumber()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Copy order number ${order.order_number}`}
        >
          <Text style={styles.orderNumber} numberOfLines={1} adjustsFontSizeToFit>{order.order_number}</Text>
          <View style={[styles.copyChip, copied && styles.copyChipDone]}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={12} color={copied ? "#FAF8F1" : HERO.text} />
          </View>
        </TouchableOpacity>
        <View style={styles.heroFooter}>
          <View>
            <Text style={styles.heroMetaLabel}>TOTAL · {itemsCount} {itemsCount === 1 ? "ITEM" : "ITEMS"}</Text>
            <Text style={styles.heroTotal} numberOfLines={1}>{formatPrice(itemsTotal)}</Text>
          </View>
          <View style={[styles.heroPayment, codUnpaid && styles.heroPaymentWarn]}>
            <Ionicons
              name={isPaid ? "checkmark-circle" : "time-outline"}
              size={13}
              color={codUnpaid ? colors.accent2.rust : HERO.text}
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
                      {done ? <Ionicons name="checkmark" size={9} color="#FAF8F1" /> : null}
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
      </LuxeHero>

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
            <Text style={styles.codTitle}>Cash on delivery</Text>
            <Text style={styles.codBody}>The customer pays in cash at delivery. Once it is collected, the order can be marked through its status flow.</Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.card, styles.invoiceRow]}
        onPress={() => router.push(`/(seller)/orders/${order.id}/invoice` as never)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open customer invoice"
      >
        <Ionicons name="document-text-outline" size={20} color={colors.olive[800]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.invoiceTitle}>Customer invoice</Text>
          <Text style={styles.invoiceSub}>
            {isPaid ? "Paid · view or save as PDF" : codUnpaid ? "Unpaid until cash is collected · view or save as PDF" : "View or save as PDF"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.olive[800]} />
      </TouchableOpacity>

      {order.notes ? (
        <View style={styles.section}>
          <SectionEyebrow index="01" label="CUSTOMER NOTE" />
          <View style={[styles.card, styles.notesCard]}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.olive[700]} style={{ marginTop: 2 }} />
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionEyebrow
          index={String(1 + (order.notes ? 1 : 0)).padStart(2, "0")}
          label={`ITEMS · ${itemsCount} ${itemsCount === 1 ? "UNIT" : "UNITS"}`}
        />
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

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(itemsTotal)}</Text>
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
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.actionBarTint} />
        {nextStatus ? (
          <TouchableOpacity
            style={[styles.primaryAction, updating && styles.actionDisabled]}
            onPress={() => handleTransition(nextStatus)}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
          >
            <View>
              <Text style={styles.primaryActionKicker}>NEXT STEP</Text>
              <Text style={styles.primaryActionText}>{updating ? "Working…" : `Mark as ${formatOrderStatusLabel(nextStatus).toLowerCase()}`}</Text>
            </View>
            {updating ? null : (
              <View style={styles.primaryActionArrow}>
                <Ionicons name="arrow-forward" size={18} color="#1A1915" />
              </View>
            )}
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

function SectionEyebrow({ index, label }: { index: string; label: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <Text style={styles.eyebrowIndex}>{index}</Text>
      <View style={styles.eyebrowRule} />
      <Text style={styles.sectionEyebrow}>{label}</Text>
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

  orderHero: { marginBottom: 14 },
  orderNumberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  copyChip: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: HERO.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.chipBorder },
  copyChipDone: { backgroundColor: HERO.ink, borderColor: HERO.ink },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full, backgroundColor: HERO.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.chipBorder },
  heroStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent2.ochre },
  heroStatusDotMuted: { backgroundColor: "rgba(83,94,44,0.35)" },
  heroStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: HERO.text },
  orderDate: { flexShrink: 1, fontFamily: fontFamilies.display.italic, fontSize: 12.5, color: HERO.mute },
  orderNumber: { flexShrink: 1, fontFamily: fontFamilies.mono.semibold, fontSize: 16, color: HERO.ink, letterSpacing: 0.2 },
  heroFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 8 },
  heroMetaLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.5, color: HERO.kicker },
  heroTotal: { marginTop: 2, fontFamily: fontFamilies.display.regular, fontSize: 30, lineHeight: 36, color: HERO.ink, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  heroPayment: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.full, backgroundColor: HERO.tile, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.tileBorder },
  heroPaymentWarn: { backgroundColor: "rgba(184,92,58,0.08)", borderColor: "rgba(184,92,58,0.28)" },
  heroPaymentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: HERO.text },
  heroPaymentTextWarn: { color: colors.accent2.rust },

  stepper: { flexDirection: "row", marginTop: 12, paddingTop: 12, marginHorizontal: -6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: HERO.divider },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepTrackRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  stepLine: { flex: 1, height: 2, backgroundColor: "rgba(83,94,44,0.12)" },
  stepLineDone: { backgroundColor: colors.olive[600] },
  stepLineHidden: { backgroundColor: "transparent" },
  stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "rgba(83,94,44,0.25)", backgroundColor: "#fffdf8", alignItems: "center", justifyContent: "center" },
  stepDotDone: { borderColor: colors.olive[600], backgroundColor: colors.olive[600] },
  stepDotCurrent: { width: 18, height: 18, borderRadius: 9, borderWidth: 5, borderColor: colors.accent2.ochre, backgroundColor: "#fffdf8" },
  stepLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 9.5, lineHeight: 12, color: "rgba(83,94,44,0.45)", textAlign: "center", paddingHorizontal: 2 },
  stepLabelActive: { color: HERO.mute },
  stepLabelCurrent: { fontFamily: fontFamilies.sans.semibold, color: HERO.ink },

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

  section: { marginTop: 26 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginLeft: 4 },
  eyebrowIndex: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: colors.olive[600] },
  eyebrowRule: { width: 18, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(26,25,21,0.25)" },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: colors.ink.mute },
  invoiceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, paddingVertical: 14 },
  invoiceTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: "#16150F" },
  invoiceSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "rgba(22,21,15,0.55)", marginTop: 2 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "rgba(83,94,44,0.1)", padding: 18, shadowColor: "#16150F", shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.14)", marginVertical: 14 },

  codBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(184,92,58,0.08)", borderWidth: 1, borderColor: "rgba(184,92,58,0.24)", borderRadius: 18, padding: 14 },
  codTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.accent2.rust },
  codBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 3, lineHeight: 17 },

  customerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1A1915", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#E8CF8F" },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: "#E8CF8F" },
  addressName: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK },
  addressPhone: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, marginTop: 2 },
  callButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  addressRow: { flexDirection: "row", gap: 10 },
  addressLine: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: INK },

  notesCard: { flexDirection: "row", gap: 10, backgroundColor: colors.olive[50] },
  notesText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: INK },

  itemCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  itemThumb: { width: 68, height: 68, borderRadius: 18, backgroundColor: colors.olive[50] },
  itemThumbEmpty: { alignItems: "center", justifyContent: "center" },
  qtyBadge: { position: "absolute", right: -5, top: -5, minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: INK, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  qtyBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: CREAM },
  itemInfo: { flex: 1, minWidth: 0, gap: 3 },
  itemName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, lineHeight: 19, color: INK },
  itemVariant: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, textTransform: "capitalize" },
  itemUnitPrice: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  itemPrice: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
  totalLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK },
  totalValue: { fontFamily: fontFamilies.display.semibold, fontSize: 26, color: INK, letterSpacing: -0.6, fontVariant: ["tabular-nums"] },

  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.12)" },
  actionBarTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(250,249,245,0.72)" },
  primaryAction: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: radii.full, backgroundColor: "#1A1915", paddingLeft: 24, paddingRight: 7, shadowColor: "#16150F", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  primaryActionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.6, color: "#8F897D", marginBottom: 2 },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: CREAM },
  primaryActionArrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#E8CF8F", alignItems: "center", justifyContent: "center" },
  refundAction: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.full, borderWidth: 1, borderColor: "rgba(184,92,58,0.3)", backgroundColor: "rgba(184,92,58,0.05)" },
  refundActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: colors.accent2.rust },
  actionDisabled: { opacity: 0.6 },
});
