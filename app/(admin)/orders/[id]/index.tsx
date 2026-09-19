import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getOrderById, transitionOrderStatus } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";
import { CUSTOMER_STATUS_STEPS, getSellerNextStatus } from "@/lib/order-lifecycle";
import {
  formatCheckoutPayment,
  formatOrderStatusLabel,
  formatPaymentStatus,
} from "@/lib/orders/seller-list";
import { orderStatusTone } from "@/lib/seller/status-tones";

const STATUSES: OrderStatus[] = CUSTOMER_STATUS_STEPS;
const CREAM = colors.paper.cream;
const RUST = "#7a2f1a";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemImage(item: any): string | null {
  const direct = item.image_url ?? item.image;
  if (typeof direct === "string" && direct.trim()) return resolveImageUrl(direct) || direct;
  const images = item.product?.images;
  if (Array.isArray(images) && images.length > 0) {
    const primary = images.find((i: any) => i?.is_primary) ?? images[0];
    if (primary?.url) return resolveImageUrl(primary.url) || primary.url;
  }
  return null;
}

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await getOrderById(id);
      return res.ok ? res.data : null;
    },
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (status: string) => transitionOrderStatus(id!, status, { skipClientGuard: true, adminOverride: true }),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Couldn't update status", res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => Alert.alert("Couldn't update status", e instanceof Error ? e.message : "Try again."),
  });

  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          <Skeleton width="100%" height={150} style={{ borderRadius: radii.xl }} />
          <Skeleton width="100%" height={110} style={{ borderRadius: radii.xl }} />
          <Skeleton width="100%" height={160} style={{ borderRadius: radii.xl }} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={26} color={colors.olive[700]} />
          </View>
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptyText}>This order may have been removed or the link is out of date.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryLabel}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sc = orderStatusTone(order.status);
  const nextStatus = getSellerNextStatus(order.status as OrderStatus);
  const statusIndex = STATUSES.indexOf(order.status as OrderStatus);
  const isTerminal = statusIndex < 0;
  const completedCount = statusIndex >= 0 ? statusIndex : 0;
  const progressPct = statusIndex >= 0 ? Math.round(((statusIndex + 1) / STATUSES.length) * 100) : 0;
  const nextOnTrack = statusIndex >= 0 && statusIndex < STATUSES.length - 1 ? STATUSES[statusIndex + 1] : null;
  const itemsCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const ship = order.shipping_address ?? order.address;
  const codUnpaid = order.payment_method === "cod" && order.payment_status !== "paid";
  const hasFailure =
    order.failure_reason || order.failed_at || order.attempt_count || order.failure_notes || order.failure_evidence_url;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: nextStatus ? 110 : 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={orderQuery.isFetching}
            onRefresh={() => orderQuery.refetch()}
            tintColor={colors.olive[700]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — order summary */}
        <View style={styles.orderHero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>ORDER DETAILS</Text>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusPillText, { color: sc.text }]}>
                {formatOrderStatusLabel(order.status)}
              </Text>
            </View>
          </View>
          <Text style={styles.orderNumber} numberOfLines={1}>
            {order.order_number}
          </Text>
          <Text style={styles.orderDate}>Placed {formatDate(order.placed_at)}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.heroMetaLabel}>ORDER TOTAL</Text>
              <Text style={styles.heroTotal}>{formatPrice(order.total, order.currency)}</Text>
            </View>
            <View style={styles.heroPayment}>
              <Ionicons
                name={order.payment_status === "paid" ? "checkmark-circle-outline" : "time-outline"}
                size={14}
                color="#E8CF8F"
              />
              <View>
                <Text style={styles.heroPaymentMethod}>{formatCheckoutPayment(order.payment_method)}</Text>
                <Text style={styles.heroPaymentStatus}>{formatPaymentStatus(order.payment_status)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Progress */}
        {isTerminal ? (
          <View style={[styles.terminalNotice, { backgroundColor: sc.bg }]}>
            <Ionicons name="information-circle-outline" size={17} color={sc.text} />
            <Text style={[styles.terminalNoticeText, { color: sc.text }]}>
              This order is {formatOrderStatusLabel(order.status).toLowerCase()} and fulfilment has stopped.
            </Text>
          </View>
        ) : (
          <View style={styles.stepperCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.stepperMeta}>FULFILLMENT PROGRESS</Text>
                <Text style={styles.progressTitle}>
                  {completedCount + 1} of {STATUSES.length} steps
                </Text>
              </View>
              <Text style={styles.progressPercent}>{progressPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <View style={styles.stepperLabels}>
              <View style={styles.stepLabelBlock}>
                <View style={styles.currentDot} />
                <View>
                  <Text style={styles.stepLabelKicker}>CURRENT</Text>
                  <Text style={styles.stepLabelCurrent}>{formatOrderStatusLabel(order.status)}</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.ink.mute} />
              <View style={[styles.stepLabelBlock, styles.nextLabelBlock]}>
                <View style={styles.nextDot} />
                <View>
                  <Text style={styles.stepLabelKicker}>NEXT</Text>
                  <Text style={styles.stepLabelNext}>
                    {nextOnTrack ? formatOrderStatusLabel(nextOnTrack) : "Complete"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* COD collect reminder */}
        {codUnpaid ? (
          <View style={styles.codBanner}>
            <Ionicons name="cash-outline" size={17} color={RUST} />
            <View style={{ flex: 1 }}>
              <Text style={styles.codTitle}>Collect {formatPrice(order.total, order.currency)} on delivery</Text>
              <Text style={styles.codBody}>Payment has not been captured for this order yet.</Text>
            </View>
          </View>
        ) : null}

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="bag-handle-outline" size={17} color={colors.olive[800]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>ORDER CONTENTS</Text>
              <Text style={styles.sectionTitle}>Items</Text>
            </View>
            {itemsCount > 0 ? (
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{itemsCount}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.itemsCard}>
            {(order.items ?? []).map((item, index) => {
              const img = itemImage(item);
              const last = index === (order.items?.length ?? 0) - 1;
              return (
                <View key={item.id} style={[styles.itemCard, last && styles.itemCardLast]}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.itemThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                      <Ionicons name="image-outline" size={19} color={colors.ink.mute} />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    {item.variant_label ? <Text style={styles.itemVariant}>{item.variant_label}</Text> : null}
                    <View style={styles.qtyPill}>
                      <Text style={styles.itemQty}>Qty {item.quantity}</Text>
                    </View>
                  </View>
                  <View style={styles.itemPriceWrap}>
                    <Text style={styles.itemPrice}>{formatPrice(item.total, order.currency)}</Text>
                    <Text style={styles.itemUnitPrice}>
                      {formatPrice(item.total / Math.max(1, item.quantity), order.currency)} each
                    </Text>
                  </View>
                </View>
              );
            })}
            {(order.items ?? []).length === 0 ? (
              <Text style={styles.noItemsText}>Item details aren't available for this order.</Text>
            ) : null}
          </View>
        </View>

        {/* Payment breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="receipt-outline" size={17} color={colors.olive[800]} />
            </View>
            <View>
              <Text style={styles.sectionEyebrow}>PAYMENT</Text>
              <Text style={styles.sectionTitle}>Price breakdown</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
            {order.discount > 0 ? (
              <SummaryRow label="Discount" value={`-${formatPrice(order.discount, order.currency)}`} />
            ) : null}
            <SummaryRow label="Shipping" value={formatPrice(order.shipping_fee, order.currency)} />
            <SummaryRow label="Tax" value={formatPrice(order.tax, order.currency)} />
            <View style={styles.totalRule} />
            <SummaryRow label="Total" value={formatPrice(order.total, order.currency)} bold />
            <SummaryRow
              label="Payment"
              value={`${formatCheckoutPayment(order.payment_method)} · ${formatPaymentStatus(order.payment_status)}`}
            />
          </View>
        </View>

        {/* Shipping address */}
        {ship ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="location-outline" size={17} color={colors.olive[800]} />
              </View>
              <View>
                <Text style={styles.sectionEyebrow}>DELIVERY</Text>
                <Text style={styles.sectionTitle}>Shipping address</Text>
              </View>
            </View>
            <View style={styles.addressCard}>
              <Text style={styles.addressName}>{ship.full_name}</Text>
              {ship.phone ? <Text style={styles.addressPhone}>{ship.phone}</Text> : null}
              <Text style={styles.addressLine}>{ship.line1}</Text>
              {ship.line2 ? <Text style={styles.addressLine}>{ship.line2}</Text> : null}
              <Text style={styles.addressLine}>
                {ship.city}
                {ship.state ? `, ${ship.state}` : ""} {ship.postal_code}
              </Text>
              {ship.country ? <Text style={styles.addressLine}>{ship.country}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Notes */}
        {order.notes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text-outline" size={17} color={colors.olive[800]} />
              </View>
              <View>
                <Text style={styles.sectionEyebrow}>CUSTOMER</Text>
                <Text style={styles.sectionTitle}>Order notes</Text>
              </View>
            </View>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Failure history */}
        {hasFailure ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, styles.sectionIconWarn]}>
                <Ionicons name="warning-outline" size={17} color={RUST} />
              </View>
              <View>
                <Text style={[styles.sectionEyebrow, { color: RUST }]}>DELIVERY ISSUE</Text>
                <Text style={styles.sectionTitle}>Failure history</Text>
              </View>
            </View>
            <View style={styles.summaryCard}>
              {order.failure_reason ? (
                <SummaryRow label="Reason" value={String(order.failure_reason).replace(/_/g, " ")} />
              ) : null}
              {order.failure_notes ? <SummaryRow label="Notes" value={order.failure_notes} /> : null}
              {order.failed_at ? (
                <SummaryRow label="Failed at" value={new Date(order.failed_at).toLocaleString()} />
              ) : null}
              {order.attempt_count != null ? (
                <SummaryRow label="Attempts" value={String(order.attempt_count)} />
              ) : null}
              {order.reschedule_count != null ? (
                <SummaryRow label="Reschedules" value={String(order.reschedule_count)} />
              ) : null}
              {order.next_retry_at ? (
                <SummaryRow label="Next retry" value={new Date(order.next_retry_at).toLocaleString()} />
              ) : null}
              {order.failure_evidence_url ? (
                <SummaryRow label="Evidence" value={order.failure_evidence_url} />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky action */}
      {nextStatus ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.primaryAction, transitionMutation.isPending && styles.primaryActionDisabled]}
            disabled={transitionMutation.isPending}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                `Mark as ${formatOrderStatusLabel(nextStatus)}?`,
                "This force-overrides the order status.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Confirm", onPress: () => transitionMutation.mutate(nextStatus) },
                ],
              )
            }
          >
            <Ionicons name="arrow-forward-circle-outline" size={17} color={CREAM} />
            <Text style={styles.primaryActionText}>
              {transitionMutation.isPending ? "Working…" : `Mark as ${formatOrderStatusLabel(nextStatus)}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, gap: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.olive[900],
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  retryLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },

  /* Hero */
  orderHero: {
    backgroundColor: colors.olive[900],
    borderRadius: radii.xl,
    padding: 20,
    marginBottom: 14,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "rgba(244,242,234,0.6)",
    letterSpacing: 1.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  orderNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    color: CREAM,
    letterSpacing: -0.4,
  },
  orderDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(244,242,234,0.62)",
    marginTop: 3,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(244,242,234,0.14)",
    marginVertical: 14,
  },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  heroMetaLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(244,242,234,0.5)",
    letterSpacing: 1,
  },
  heroTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: CREAM,
    marginTop: 2,
  },
  heroPayment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroPaymentMethod: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: CREAM,
    textAlign: "right",
  },
  heroPaymentStatus: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: "rgba(244,242,234,0.6)",
    textAlign: "right",
  },

  /* Progress */
  stepperCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    padding: 16,
    marginBottom: 14,
    ...shadows.soft,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepperMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  progressTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    marginTop: 3,
  },
  progressPercent: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.olive[800],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#efebdf",
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[700],
  },
  stepperLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  stepLabelBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextLabelBlock: {},
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.olive[700],
  },
  nextDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.olive[400],
    backgroundColor: "#ffffff",
  },
  stepLabelKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    color: colors.light.mutedForeground,
    letterSpacing: 0.9,
  },
  stepLabelCurrent: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
    marginTop: 1,
  },
  stepLabelNext: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  terminalNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  terminalNoticeText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    lineHeight: 17,
  },

  /* COD banner */
  codBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(184,92,58,0.10)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.35)",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  codTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: RUST,
  },
  codBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: RUST,
    opacity: 0.85,
    marginTop: 1,
  },

  /* Sections */
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconWarn: {
    backgroundColor: "rgba(184,92,58,0.10)",
    borderColor: "rgba(184,92,58,0.30)",
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 1,
  },
  sectionCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: CREAM,
  },

  /* Items */
  itemsCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    overflow: "hidden",
    ...shadows.soft,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#efece3",
  },
  itemCardLast: {
    borderBottomWidth: 0,
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  itemThumbEmpty: {
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  itemVariant: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  qtyPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "#e4dfd3",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  itemQty: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 0.3,
  },
  itemPriceWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  itemPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  itemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  noItemsText: {
    padding: 16,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },

  /* Summary card */
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    padding: 16,
    ...shadows.soft,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 5,
  },
  summaryLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  summaryLabelBold: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  summaryValue: {
    flexShrink: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
    textAlign: "right",
  },
  summaryValueBold: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.olive[900],
  },
  totalRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e8e3d8",
    marginVertical: 8,
  },

  /* Address + notes */
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    padding: 16,
    ...shadows.soft,
  },
  addressName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  addressPhone: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.olive[800],
    marginTop: 2,
    marginBottom: 6,
  },
  addressLine: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    lineHeight: 19,
  },
  notesCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    padding: 16,
    ...shadows.soft,
  },
  notesText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.foreground,
    fontStyle: "italic",
    lineHeight: 19,
  },

  /* Sticky action */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(250,248,243,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0dbcd",
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
    paddingVertical: 14,
    ...shadows.soft,
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: CREAM,
  },
});
