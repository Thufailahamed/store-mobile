import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import * as Linking from "expo-linking";
import {
  getOrderById,
  cancelOrder as cancelOrderRpc,
  cancelOrderItems as cancelOrderItemsRpc,
} from "@/lib/api";
import { getOrderInvoiceBackend, resendOrderReceiptBackend } from "@/lib/api/backend";
import { getPayHereSession } from "@/lib/api/payments";
import { PayHereCheckout } from "@/components/payments/PayHereCheckout";
import { useCart } from "@/lib/stores/cart-store";
import { canBuyerCancelInWindow, isTrackableStatus } from "@/lib/order-lifecycle";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_HERO_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    copy: string;
    icon: keyof typeof Ionicons.glyphMap;
    gradient: [string, string, string];
    accent: string;
  }
> = {
  pending: {
    label: "PENDING CONFIRMATION",
    copy: "We have received your order. Atelier confirmation and quality check is in progress.",
    icon: "hourglass-outline",
    gradient: ["#1c1910", "#2b2313", "#14120b"],
    accent: "#E8CF8F",
  },
  confirmed: {
    label: "CONFIRMED AT ATELIER",
    copy: "Your acquisition is confirmed and currently being prepared by the artisan designer.",
    icon: "checkmark-circle-outline",
    gradient: ["#181b12", "#273019", "#13160e"],
    accent: "#E8CF8F",
  },
  processing: {
    label: "PREPARING & PACKAGING",
    copy: "Your selected pieces are being authenticated, packaged in signature boxes, and prepared for dispatch.",
    icon: "cube-outline",
    gradient: ["#181b12", "#273019", "#13160e"],
    accent: "#E8CF8F",
  },
  shipped: {
    label: "DISPATCHED · IN TRANSIT",
    copy: "Your parcel is traveling through our premium courier network with live route monitoring.",
    icon: "airplane-outline",
    gradient: ["#0f172a", "#1e293b", "#090d16"],
    accent: "#93c5fd",
  },
  out_for_delivery: {
    label: "OUT FOR DELIVERY TODAY",
    copy: "Your dedicated courier is en route to your delivery address. Signature may be requested.",
    icon: "bicycle-outline",
    gradient: ["#0c2117", "#163826", "#081710"],
    accent: "#6ee7b7",
  },
  delivered: {
    label: "SAFELY DELIVERED",
    copy: "Package safely delivered to your destination. We invite you to unbox and share your review.",
    icon: "sparkles-outline",
    gradient: ["#0c2117", "#163826", "#081710"],
    accent: "#6ee7b7",
  },
  cancelled: {
    label: "ORDER CANCELLED",
    copy: "This acquisition was cancelled. Any pre-authorized charges have been released.",
    icon: "close-circle-outline",
    gradient: ["#211010", "#381919", "#170909"],
    accent: "#fca5a5",
  },
  returned: {
    label: "PIECES RETURNED",
    copy: "Returned pieces have been safely received and inspected at our logistics center.",
    icon: "return-down-back-outline",
    gradient: ["#1e1b13", "#2e2719", "#15130b"],
    accent: "#e5c986",
  },
  refunded: {
    label: "REFUND PROCESSED",
    copy: "A full refund has been credited back to your original payment method.",
    icon: "cash-outline",
    gradient: ["#1e1b13", "#2e2719", "#15130b"],
    accent: "#e5c986",
  },
  failed_attempt: {
    label: "DELIVERY RESCHEDULED",
    copy: "The courier attempted delivery but was unable to complete it. Re-delivery is queued.",
    icon: "alert-circle-outline",
    gradient: ["#241212", "#3b1a1a", "#170a0a"],
    accent: "#fca5a5",
  },
};

const MILESTONES: { key: OrderStatus; label: string; stepNumber: number }[] = [
  { key: "pending", label: "PLACED", stepNumber: 1 },
  { key: "confirmed", label: "CONFIRMED", stepNumber: 2 },
  { key: "shipped", label: "DISPATCHED", stepNumber: 3 },
  { key: "delivered", label: "DELIVERED", stepNumber: 4 },
];

function getMilestoneIndex(status: OrderStatus): number {
  if (status === "pending") return 0;
  if (status === "confirmed" || status === "processing") return 1;
  if (status === "shipped" || status === "out_for_delivery") return 2;
  if (status === "delivered") return 3;
  return 0;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [payhere, setPayhere] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const [retryingPay, setRetryingPay] = useState(false);

  const loadOrder = useCallback(() => {
    if (!id) return;
    const orderId = id as string;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    getOrderById(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setOrder(res.data);
      } else {
        setFetchError(res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const cleanup = loadOrder();
    return cleanup;
  }, [loadOrder]);

  const handleCancelOrder = async () => {
    if (!order) return;
    Alert.alert("Cancel Acquisition", "Why are you cancelling this order?", [
      { text: "Keep order", style: "cancel" },
      { text: "Changed my mind", onPress: () => submitCancel("changed_mind") },
      { text: "Ordered by mistake", onPress: () => submitCancel("ordered_by_mistake") },
      { text: "Found alternative", onPress: () => submitCancel("found_cheaper") },
      { text: "Other reason", onPress: () => submitCancel("other") },
    ]);
  };

  const submitCancel = async (reason: string) => {
    if (!order) return;
    setCancelling(true);
    const res = await cancelOrderRpc(order.id, reason);
    setCancelling(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setOrder({ ...order, status: "cancelled" });
    toast("Order cancelled successfully", "success");
  };

  const handleReorder = () => {
    if (!order?.items?.length) return;
    const addItem = useCart.getState().addItem;
    for (const item of order.items) {
      if ((item as { status?: string }).status === "cancelled") continue;
      addItem({
        productId: item.product_id,
        variantId: item.variant_id ?? null,
        storeId: item.store_id,
        name: item.product_name,
        variantLabel: item.variant_label,
        price: item.unit_price,
        image: item.product?.images?.find((i) => i.is_primary)?.url ?? item.product?.images?.[0]?.url,
        quantity: item.quantity,
        stock: null,
      });
    }
    toast("Pieces added to shopping bag", "success");
    router.push("/(main)/cart" as never);
  };

  const handleCancelItem = async (itemId: string, itemName: string) => {
    if (!order) return;
    Alert.alert(
      "Cancel Piece",
      `Cancel "${itemName}"? The remainder of your parcel will be fulfilled.`,
      [
        { text: "Keep piece", style: "cancel" },
        {
          text: "Cancel piece",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            const res = await cancelOrderItemsRpc(order.id, [itemId]);
            setCancelling(false);
            if (!res.ok) {
              toast(res.error, "error");
              return;
            }
            const refresh = await getOrderById(order.id);
            if (refresh.ok) setOrder(refresh.data);
            if (res.data.remaining_items === 0) {
              toast("Order cancelled", "success");
            } else {
              toast("Piece removed from order", "success");
            }
          },
        },
      ]
    );
  };

  const shareOrder = async () => {
    if (!order) return;
    try {
      await Share.share({
        title: `LUXE Order #${order.order_number}`,
        message: `LUXE Acquisition #${order.order_number} · ${formatPrice(order.total, order.currency)} · ${order.items?.length ?? 0} pieces`,
      });
    } catch {}
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    const res = await getOrderInvoiceBackend(order.id);
    const url = res.ok ? res.data.invoice?.invoice_url : null;
    if (url) {
      await Linking.openURL(url);
      return;
    }
    toast(res.ok ? "Generating invoice summary…" : res.error, "info");
    await shareOrder();
  };

  const handleResendReceipt = async () => {
    if (!order) return;
    const res = await resendOrderReceiptBackend(order.id);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Receipt dispatched to your email", "success");
  };

  const handleRetryPay = async () => {
    if (!order) return;
    setRetryingPay(true);
    const groupId =
      typeof (order as unknown as { metadata?: { group_id?: string } }).metadata?.group_id === "string"
        ? (order as unknown as { metadata: { group_id: string } }).metadata.group_id
        : undefined;
    const res = await getPayHereSession(order.id, groupId ? { groupId } : {});
    setRetryingPay(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setPayhere(res.data);
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarKicker}>ACQUISITION</Text>
            <Text style={styles.topBarTitle}>Order Details</Text>
          </View>
          <View style={styles.navBtnPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.olive[700]} />
          <Text style={styles.loadingText}>
            {fetchError ? "Unable to load order." : "Retrieving acquisition credentials…"}
          </Text>
          {fetchError ? (
            <TouchableOpacity style={styles.retryBtn} onPress={loadOrder} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry connection</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const heroConfig = STATUS_HERO_CONFIG[order.status] || STATUS_HERO_CONFIG.pending;
  const currentStep = getMilestoneIndex(order.status);
  const canCancel = canBuyerCancelInWindow(order.status, order.placed_at);
  const canReturn = order.status === "delivered";
  const canTrack = isTrackableStatus(order.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarKicker}>ACQUISITION</Text>
          <Text style={styles.topBarTitle}>#{order.order_number}</Text>
        </View>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={shareOrder}
          activeOpacity={0.7}
          accessibilityLabel="Share"
        >
          <Ionicons name="share-outline" size={18} color={colors.light.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Haute Couture Status Hero Card */}
        <View style={styles.statusHeroCard}>
          <LinearGradient
            colors={heroConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusHeroGradient}
          >
            {/* Guilloche SVG Wave Accent Lines */}
            <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Path
                d="M-30 20 C 70 85, 180 15, 270 75 S 370 25, 450 70"
                fill="none"
                stroke="rgba(200, 164, 74, 0.08)"
                strokeWidth={1.2}
              />
              <Path
                d="M-30 35 C 70 100, 180 30, 270 90 S 370 40, 450 85"
                fill="none"
                stroke="rgba(200, 164, 74, 0.08)"
                strokeWidth={1.2}
              />
            </Svg>

            <View style={styles.statusHeroTopRow}>
              <View style={[styles.statusHeroBadge, { borderColor: heroConfig.accent + "50" }]}>
                <Ionicons name={heroConfig.icon} size={11} color={heroConfig.accent} />
                <Text style={[styles.statusHeroBadgeText, { color: heroConfig.accent }]}>
                  {heroConfig.label}
                </Text>
              </View>

              <View style={styles.statusHeroDateChip}>
                <Text style={styles.statusHeroDateText}>
                  {new Date(order.placed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.statusHeroCopyRow}>
              <View style={styles.statusHeroIconRing}>
                <Ionicons name={heroConfig.icon} size={22} color={heroConfig.accent} />
              </View>
              <Text style={styles.statusHeroCopyText}>{heroConfig.copy}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Editorial Logistics Progress Tracker */}
        {order.status !== "cancelled" && order.status !== "returned" && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <View>
                <Text style={styles.cardKicker}>DELIVERY TIMELINE</Text>
                <Text style={styles.cardTitle}>Parcel Progress</Text>
              </View>

              <View style={styles.placedDatePill}>
                <Ionicons name="calendar-outline" size={12} color={colors.olive[700]} />
                <Text style={styles.placedDatePillText}>
                  {new Date(order.placed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </View>

            {/* Stepper Nodes */}
            <View style={styles.stepperWrap}>
              <View style={styles.stepperLineTrack} />
              <View
                style={[
                  styles.stepperLineActive,
                  { width: `${(currentStep / (MILESTONES.length - 1)) * 100}%` },
                ]}
              />

              <View style={styles.stepperNodesRow}>
                {MILESTONES.map((step, idx) => {
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <View key={step.key} style={styles.stepperNodeCol}>
                      <View
                        style={[
                          styles.stepperCircle,
                          isDone && styles.stepperCircleDone,
                          isCurrent && styles.stepperCircleCurrent,
                        ]}
                      >
                        {isDone ? (
                          <Ionicons name="checkmark-sharp" size={11} color="#ffffff" />
                        ) : (
                          <View style={styles.stepperInnerDot} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepperLabelText,
                          isDone && styles.stepperLabelTextDone,
                          isCurrent && styles.stepperLabelTextCurrent,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Quick Luxury Action Chips */}
        <View style={styles.actionChipsRow}>
          {canTrack && (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() =>
                router.push({
                  pathname: "/(main)/account/orders/[id]/track" as never,
                  params: { id: order.id },
                })
              }
              activeOpacity={0.75}
            >
              <Ionicons name="navigate-outline" size={14} color={colors.olive[700]} />
              <Text style={styles.actionPillText}>Live tracking</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionPill}
            onPress={handleDownloadInvoice}
            activeOpacity={0.75}
          >
            <Ionicons name="document-text-outline" size={14} color={colors.olive[700]} />
            <Text style={styles.actionPillText}>Invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPill}
            onPress={() =>
              router.push({
                pathname: "/(main)/account/tickets/new",
                params: { orderId: order.id },
              } as never)
            }
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubbles-outline" size={14} color={colors.olive[700]} />
            <Text style={styles.actionPillText}>Concierge help</Text>
          </TouchableOpacity>

          {["confirmed", "packed", "shipped", "delivered", "processing", "out_for_delivery"].includes(
            order.status,
          ) ? (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={handleResendReceipt}
              activeOpacity={0.75}
            >
              <Ionicons name="mail-outline" size={14} color={colors.olive[700]} />
              <Text style={styles.actionPillText}>Email receipt</Text>
            </TouchableOpacity>
          ) : null}

          {canReturn && (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() =>
                router.push({
                  pathname: "/(main)/account/returns/new" as never,
                  params: { orderId: order.id },
                })
              }
              activeOpacity={0.75}
            >
              <Ionicons name="refresh-outline" size={14} color={colors.olive[700]} />
              <Text style={styles.actionPillText}>Request return</Text>
            </TouchableOpacity>
          )}

          {order.status === "delivered" || order.status === "cancelled" ? (
            <TouchableOpacity style={styles.actionPill} onPress={handleReorder} activeOpacity={0.75}>
              <Ionicons name="repeat-outline" size={14} color={colors.olive[700]} />
              <Text style={styles.actionPillText}>Reorder pieces</Text>
            </TouchableOpacity>
          ) : null}

          {canCancel && (
            <TouchableOpacity
              style={[styles.actionPill, styles.actionPillDanger]}
              onPress={handleCancelOrder}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle-outline" size={14} color={colors.light.destructive} />
              <Text style={[styles.actionPillText, styles.actionPillTextDanger]}>Cancel order</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Items Showcase Section */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderWithKicker}>
            <Text style={styles.cardKicker}>CURATED SELECTIONS</Text>
            <Text style={styles.cardTitle}>Items in this parcel</Text>
          </View>

          <View style={styles.itemsList}>
            {order.items?.map((item, index) => {
              const img =
                item.product?.images?.find((i) => i.is_primary)?.url ?? item.product?.images?.[0]?.url;
              const isItemCancelled = (item as any).status === "cancelled";
              const canItemCancel = canCancel && !isItemCancelled && (order.items?.length ?? 0) > 1;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < (order.items?.length ?? 0) - 1 && styles.itemRowDivider,
                  ]}
                >
                  <View style={styles.itemThumbWrapper}>
                    {img ? (
                      <Image
                        source={{ uri: img }}
                        style={styles.itemThumbImg}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.itemThumbPlaceholder}>
                        <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
                      </View>
                    )}
                  </View>

                  <View style={styles.itemDetailsCol}>
                    <Text style={styles.itemBrandKicker} numberOfLines={1}>
                      {item.product?.brand?.name || item.product?.store?.name || "LUXE CURATED"}
                    </Text>
                    <Text
                      style={[styles.itemProductName, isItemCancelled && styles.itemCancelledStrike]}
                      numberOfLines={2}
                    >
                      {item.product_name}
                    </Text>

                    <View style={styles.itemVariantRow}>
                      {item.variant_label ? (
                        <View style={styles.variantBadge}>
                          <Text style={styles.variantBadgeText}>{item.variant_label}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.itemQuantityText}>Qty: {item.quantity}</Text>
                    </View>

                    {canItemCancel && (
                      <TouchableOpacity
                        style={styles.cancelItemBtn}
                        onPress={() => handleCancelItem(item.id, item.product_name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle-outline" size={12} color={colors.light.destructive} />
                        <Text style={styles.cancelItemBtnText}>Cancel piece</Text>
                      </TouchableOpacity>
                    )}

                    {isItemCancelled && (
                      <View style={styles.cancelledBadgePill}>
                        <Text style={styles.cancelledBadgePillText}>CANCELLED</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemPriceCol}>
                    <Text
                      style={[styles.itemPriceTotal, isItemCancelled && styles.itemCancelledStrike]}
                    >
                      {formatPrice(item.total, order.currency)}
                    </Text>
                    <Text style={styles.itemUnitPriceSub}>
                      Unit {formatPrice(item.unit_price, order.currency)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Acquisition Breakdown / Summary */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderWithKicker}>
            <Text style={styles.cardKicker}>SETTLEMENT</Text>
            <Text style={styles.cardTitle}>Payment summary</Text>
          </View>

          <View style={styles.summaryTable}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Subtotal</Text>
              <Text style={styles.summaryLineValue}>
                {formatPrice(order.subtotal, order.currency)}
              </Text>
            </View>

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>White-glove delivery</Text>
              <Text
                style={[
                  styles.summaryLineValue,
                  order.shipping_fee === 0 && styles.freeShippingValue,
                ]}
              >
                {order.shipping_fee === 0 ? "COMPLIMENTARY" : formatPrice(order.shipping_fee, order.currency)}
              </Text>
            </View>

            {order.discount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Promotional Privilege</Text>
                <Text style={[styles.summaryLineValue, styles.discountValue]}>
                  -{formatPrice(order.discount, order.currency)}
                </Text>
              </View>
            )}

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Duties & taxes</Text>
              <Text style={styles.summaryLineValue}>{formatPrice(order.tax, order.currency)}</Text>
            </View>

            <View style={styles.summaryTotalRow}>
              <View>
                <Text style={styles.totalGrandLabel}>Total settled</Text>
                <Text style={styles.totalTaxIncludedText}>Inclusive of all fees</Text>
              </View>
              <Text style={styles.totalGrandValue}>
                {formatPrice(order.total, order.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Shipping Destination Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderWithKicker}>
            <Text style={styles.cardKicker}>LOGISTICS</Text>
            <Text style={styles.cardTitle}>Delivery destination</Text>
          </View>

          {!order.address && !order.shipping_address ? (
            <View style={styles.addressEmptyBox}>
              <Ionicons name="location-outline" size={20} color={colors.light.mutedForeground} />
              <Text style={styles.addressEmptyText}>No delivery destination details on record.</Text>
            </View>
          ) : (
            <View style={styles.addressBox}>
              <View style={styles.addressIconWrap}>
                <Ionicons name="location" size={18} color={colors.olive[700]} />
              </View>
              <View style={styles.addressTextContent}>
                <Text style={styles.addressRecipientName}>
                  {order.address?.full_name || order.shipping_address?.full_name}
                </Text>
                <Text style={styles.addressStreetText}>
                  {order.address?.line1 || order.shipping_address?.line1}
                  {order.address?.line2 || order.shipping_address?.line2
                    ? `, ${order.address?.line2 || order.shipping_address?.line2}`
                    : ""}
                </Text>
                <Text style={styles.addressCityStateText}>
                  {order.address?.city || order.shipping_address?.city},{" "}
                  {order.address?.state || order.shipping_address?.state}{" "}
                  {order.address?.postal_code || order.shipping_address?.postal_code}
                </Text>
                {(order.address?.phone || order.shipping_address?.phone) ? (
                  <View style={styles.phoneChip}>
                    <Ionicons name="call-outline" size={11} color={colors.olive[700]} />
                    <Text style={styles.phoneChipText}>
                      {order.address?.phone || order.shipping_address?.phone}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* Payment Method Details */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderWithKicker}>
            <Text style={styles.cardKicker}>AUTHENTICATION</Text>
            <Text style={styles.cardTitle}>Payment settlement</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <View style={styles.paymentMethodLeft}>
              <View style={styles.paymentIconSquare}>
                <Ionicons
                  name={order.payment_method === "cod" ? "cash-outline" : "card-outline"}
                  size={18}
                  color={colors.olive[700]}
                />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>
                  {order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}
                </Text>
                <Text style={styles.paymentMethodSub}>
                  {order.payment_method === "cod"
                    ? "Payable upon signature delivery"
                    : "Encrypted & authenticated"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.paymentStatusBadge,
                order.payment_status === "paid" ? styles.statusPaid : styles.statusPending,
              ]}
            >
              <Ionicons
                name={order.payment_status === "paid" ? "checkmark-circle" : "time"}
                size={11}
                color={order.payment_status === "paid" ? "#047857" : "#85651b"}
              />
              <Text
                style={[
                  styles.paymentStatusBadgeText,
                  order.payment_status === "paid" ? styles.textPaid : styles.textPending,
                ]}
              >
                {order.payment_status?.toUpperCase() || "PENDING"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* PayHere Checkout Modal */}
      {payhere ? (
        <PayHereCheckout
          visible
          action={payhere.action}
          fields={payhere.fields}
          orderId={order.id}
          onClose={() => setPayhere(null)}
          onReturnFromGateway={() => {
            setPayhere(null);
            toast("Payment submitted — refreshing order", "success");
            loadOrder();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f7f2",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  retryBtn: {
    marginTop: spacing[3],
    backgroundColor: colors.olive[700],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  retryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#ffffff",
  },

  /* Top Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
    backgroundColor: "#f8f7f2",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  topBarCenter: {
    alignItems: "center",
    gap: 1,
  },
  topBarKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[4],
  },

  /* Haute Couture Status Hero */
  statusHeroCard: {
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.soft,
  },
  statusHeroGradient: {
    padding: spacing[5],
    position: "relative",
  },
  statusHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  statusHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusHeroBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  statusHeroDateChip: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusHeroDateText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.5,
  },
  statusHeroCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  statusHeroIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  statusHeroCopyText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#FAF8F1",
    lineHeight: 18,
  },

  /* Progress Stepper Card */
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  cardKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  placedDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  placedDatePillText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },

  stepperWrap: {
    position: "relative",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  stepperLineTrack: {
    position: "absolute",
    top: 13,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: "#e5e7eb",
    zIndex: 1,
  },
  stepperLineActive: {
    position: "absolute",
    top: 13,
    left: 20,
    height: 2,
    backgroundColor: colors.olive[700],
    zIndex: 2,
  },
  stepperNodesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 3,
  },
  stepperNodeCol: {
    alignItems: "center",
    width: 68,
    gap: 6,
  },
  stepperCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperCircleDone: {
    backgroundColor: colors.olive[700],
    borderColor: colors.olive[700],
  },
  stepperCircleCurrent: {
    borderColor: "#C8A44A",
    backgroundColor: "#1c2012",
  },
  stepperInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
  },
  stepperLabelText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },
  stepperLabelTextDone: {
    color: colors.light.foreground,
  },
  stepperLabelTextCurrent: {
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651b",
  },

  /* Action Chips */
  actionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  actionPillDanger: {
    borderColor: "rgba(192, 57, 43, 0.25)",
    backgroundColor: "rgba(192, 57, 43, 0.04)",
  },
  actionPillText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.foreground,
  },
  actionPillTextDanger: {
    color: colors.light.destructive,
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  cardHeaderWithKicker: {
    gap: 2,
    marginBottom: spacing[3],
  },

  /* Items */
  itemsList: {
    gap: spacing[2],
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  itemRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f2eb",
  },
  itemThumbWrapper: {
    width: 64,
    height: 76,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#f5f4ef",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  itemThumbImg: {
    width: "100%",
    height: "100%",
  },
  itemThumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemDetailsCol: {
    flex: 1,
    gap: 2,
  },
  itemBrandKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  itemProductName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  itemCancelledStrike: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  itemVariantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  variantBadge: {
    backgroundColor: "#f5f4ef",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  variantBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
  },
  itemQuantityText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  cancelItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  cancelItemBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.destructive,
  },
  cancelledBadgePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(192, 57, 43, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  cancelledBadgePillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.light.destructive,
  },
  itemPriceCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  itemPriceTotal: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  itemUnitPriceSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  /* Summary Table */
  summaryTable: {
    gap: spacing[2],
  },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLineLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  summaryLineValue: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  freeShippingValue: {
    fontFamily: fontFamilies.mono.semibold,
    color: "#047857",
  },
  discountValue: {
    color: colors.olive[700],
  },
  summaryTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0ede2",
    paddingTop: spacing[3],
    marginTop: spacing[2],
  },
  totalGrandLabel: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  totalTaxIncludedText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  totalGrandValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 18,
    color: colors.olive[900],
    letterSpacing: -0.3,
  },

  /* Shipping Box */
  addressBox: {
    flexDirection: "row",
    gap: spacing[3],
    backgroundColor: "#faf9f5",
    borderRadius: radii.xl,
    padding: spacing[3] + 2,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  addressTextContent: {
    flex: 1,
    gap: 2,
  },
  addressRecipientName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  addressStreetText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    lineHeight: 17,
  },
  addressCityStateText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  phoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  phoneChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[800],
  },
  addressEmptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[3],
  },
  addressEmptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },

  /* Payment Row */
  paymentInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#faf9f5",
    borderRadius: radii.xl,
    padding: spacing[3] + 2,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  paymentIconSquare: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  paymentMethodTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  paymentMethodSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  paymentStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusPaid: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  statusPending: {
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  paymentStatusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  textPaid: {
    color: "#047857",
  },
  textPending: {
    color: "#85651b",
  },
});
