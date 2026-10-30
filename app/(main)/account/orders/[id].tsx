import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton, useToast } from "@/components/ui";
import * as Linking from "expo-linking";
import {
  getOrderById,
  cancelOrder as cancelOrderRpc,
  cancelOrderItems as cancelOrderItemsRpc,
} from "@/lib/api";
import { resendOrderReceiptBackend } from "@/lib/api/backend";
import { getPaymentsLkSession, getStripeCheckoutSession, pollOrderPaymentStatus } from "@/lib/api/payments";
import { runPaymentsLkCheckout } from "@/lib/paymentslk-checkout";
import * as WebBrowser from "expo-web-browser";
import { useCart } from "@/lib/stores/cart-store";
import { canBuyerCancelInWindow, isTrackableStatus } from "@/lib/order-lifecycle";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { LUX, ORDER_TONE } from "@/components/orders/luxe-order";
import {
  C,
  CLOSED,
  RIBBON,
  ParcelArt,
  TrackRail,
  etaFor,
  routeStyles,
  shortDate,
} from "@/components/orders/parcel-track";
import { DetailTopBar, MenuSheet, type MenuItem } from "@/components/orders/detail-chrome";

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setCancelling] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryingPay, setRetryingPay] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      // Product was permanently deleted by the seller since this order.
      if (!item.product_id) continue;
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

  const handleDownloadInvoice = () => {
    if (!order) return;
    router.push(`/account/orders/${order.id}/invoice` as never);
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
    try {
      const groupId =
        typeof (order as unknown as { metadata?: { group_id?: string } }).metadata?.group_id === "string"
          ? (order as unknown as { metadata: { group_id: string } }).metadata.group_id
          : undefined;

      if (order.payment_method === "stripe") {
        // Hosted Stripe Checkout has no app deep link — open the secure
        // page and confirm via the webhook-backed status poll on return.
        const res = await getStripeCheckoutSession(order.id, groupId ? { groupId } : {});
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        await WebBrowser.openBrowserAsync(res.data.url);
        const poll = await pollOrderPaymentStatus(order.id, { maxAttempts: 15, intervalMs: 3000 });
        if (poll.ok) {
          toast("Payment complete", "success");
        } else {
          toast("Payment was not completed — you can retry any time", "info");
        }
      } else {
        const res = await getPaymentsLkSession(order.id, groupId ? { groupId } : {});
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        const result = await runPaymentsLkCheckout(res.data.url);
        if (result.status === "succeeded") {
          const poll = await pollOrderPaymentStatus(order.id);
          if (!poll.ok) {
            toast(poll.error, "error");
          } else {
            toast("Payment complete", "success");
          }
        } else if (result.status !== "dismissed") {
          toast("Payment was not completed — you can retry any time", "info");
        }
      }
      loadOrder();
    } finally {
      setRetryingPay(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.root}>
        <LinearGradient
          pointerEvents="none"
          colors={[C.glow, C.glowSoft, C.paper]}
          locations={[0, 0.55, 1]}
          style={styles.glow}
        />
        <SafeAreaView style={styles.flex} edges={["top"]}>
          <DetailTopBar title="Order Details" onBack={() => router.back()} />
          <View style={styles.loadingContainer}>
            {fetchError ? (
              <>
                <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
                <Text style={styles.loadingText}>Unable to load this order.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadOrder} activeOpacity={0.85}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ width: "100%", gap: 14 }}>
                <Skeleton height={300} borderRadius={28} />
                <Skeleton height={64} borderRadius={20} />
                <Skeleton height={240} borderRadius={26} />
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const tone = ORDER_TONE[order.status] || ORDER_TONE.pending;
  const ribbon = RIBBON[order.status] ?? RIBBON.pending;
  const items = order.items ?? [];
  const itemCount = items.reduce((n, it) => n + (it.quantity ?? 1), 0);
  const canCancel = canBuyerCancelInWindow(order.status, order.placed_at);
  const canReturn = order.status === "delivered";
  const canTrack = isTrackableStatus(order.status);
  const canEmail = ["confirmed", "packed", "shipped", "delivered", "processing", "out_for_delivery"].includes(
    order.status,
  );
  const canReorder = order.status === "delivered" || order.status === "cancelled";
  const closed = CLOSED.includes(order.status);

  const stores = Array.from(new Set(items.map((i) => i.store?.name).filter((n): n is string => !!n)));
  const seller = stores.length === 0 ? "LUXE" : stores.length === 1 ? stores[0] : `${stores[0]} +${stores.length - 1}`;
  const ship = order.shipping_address ?? order.address;
  const to = ship ? [ship.city, ship.state].filter(Boolean).join(", ") || ship.line1 : "Your address";
  const eta = etaFor(order).eta;

  let statusLine: string;
  if (order.status === "delivered") statusLine = `Delivered ${shortDate(order.delivered_at ?? order.placed_at)}`;
  else if (closed) statusLine = tone.label;
  else if (order.status === "out_for_delivery") statusLine = `${tone.label} · arriving today`;
  else if (order.status === "failed_attempt") statusLine = `${tone.label} · new attempt queued`;
  else {
    const days = Math.max(1, Math.ceil((eta - Date.now()) / 86_400_000));
    statusLine = `${tone.label} · arriving in ${days} day${days === 1 ? "" : "s"}`;
  }
  const statusRight = closed || order.status === "delivered" ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : `Est. ${shortDate(eta)}`;

  const openTicket = () =>
    router.push({ pathname: "/(main)/account/tickets/new", params: { orderId: order.id } } as never);
  const openTrack = () =>
    router.push({ pathname: "/(main)/account/orders/[id]/track" as never, params: { id: order.id } });
  const openReturn = () =>
    router.push({ pathname: "/(main)/account/returns/new" as never, params: { orderId: order.id } });

  const menu: MenuItem[] = [
    { icon: "share-outline", label: "Share order", onPress: shareOrder },
    { icon: "document-text-outline", label: "View invoice", onPress: handleDownloadInvoice },
    ...(canEmail ? [{ icon: "mail-outline" as const, label: "Email receipt", onPress: handleResendReceipt }] : []),
    { icon: "chatbubbles-outline", label: "Contact concierge", onPress: openTicket },
    ...(canCancel
      ? [{ icon: "close-circle-outline" as const, label: "Cancel order", onPress: handleCancelOrder, danger: true }]
      : []),
  ];

  const showPay =
    order.payment_status !== "paid" &&
    (order.payment_method === "paymentslk" || order.payment_method === "stripe") &&
    !["cancelled", "failed_attempt", "refunded", "returned", "delivered"].includes(order.status ?? "");

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.glow}
      />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <DetailTopBar title="Order Details" onBack={() => router.back()} onMore={() => setMenuOpen(true)} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Items — sits where the map would be */}
          <View style={styles.itemsHead}>
            <Text style={styles.itemsKicker}>IN THIS PARCEL</Text>
            <Text style={styles.itemsCount}>
              {items.length} piece{items.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.itemsCard}>
            {items.map((item, i) => {
              const img =
                item.image_url ??
                item.product?.images?.find((im) => im.is_primary)?.url ??
                item.product?.images?.[0]?.url;
              const isItemCancelled = item.status === "cancelled";
              const canItemCancel = canCancel && !isItemCancelled && items.length > 1;
              return (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(i * 60).duration(380)}
                  style={[styles.itemRow, i > 0 && styles.itemRowDivider]}
                >
                  <Pressable
                    style={styles.itemThumb}
                    onPress={() =>
                      item.product?.slug && router.push(`/(main)/products/${item.product.slug}` as never)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.product_name}`}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    ) : (
                      <Ionicons name="shirt-outline" size={22} color={C.muted} />
                    )}
                  </Pressable>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemBrand} numberOfLines={1}>
                      {(item.store?.name || item.product?.brand?.name || "LUXE curated").toUpperCase()}
                    </Text>
                    <Text style={[styles.itemName, isItemCancelled && styles.strike]} numberOfLines={1}>
                      {item.product_name}
                    </Text>
                    <View style={styles.itemMeta}>
                      {item.variant_label ? (
                        <View style={styles.variantChip}>
                          <Text style={styles.variantChipText} numberOfLines={1}>
                            {item.variant_label}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.unitText}>Qty {item.quantity}</Text>
                      {isItemCancelled ? <Text style={styles.cancelPiece}>Cancelled</Text> : null}
                      {canItemCancel ? (
                        <TouchableOpacity
                          onPress={() => handleCancelItem(item.id, item.product_name)}
                          hitSlop={8}
                          accessibilityRole="button"
                        >
                          <Text style={styles.cancelPiece}>Cancel</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.itemPrice, isItemCancelled && styles.strike]}>
                    {formatPrice(item.total, order.currency)}
                  </Text>
                </Animated.View>
              );
            })}
          </View>

          {/* Bottom sheet */}
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>{seller.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.sellerMeta}>
                  <Text style={styles.sellerKicker}>Sold by</Text>
                  <Ionicons name="shield-checkmark" size={12} color={C.accent} />
                  <Text style={styles.sellerVerified}>Verified</Text>
                </View>
                <Text style={styles.sellerName} numberOfLines={1}>{seller}</Text>
              </View>
              <TouchableOpacity
                style={styles.roundDark}
                onPress={handleDownloadInvoice}
                activeOpacity={0.85}
                accessibilityLabel="Invoice"
              >
                <Ionicons name="document-text-outline" size={18} color={C.cream} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roundDark}
                onPress={openTicket}
                activeOpacity={0.85}
                accessibilityLabel="Contact concierge"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={C.cream} />
              </TouchableOpacity>
            </View>

            <View style={styles.statusBar}>
              <View style={[styles.statusDot, { backgroundColor: closed ? C.rust : C.ink }]} />
              <Text style={styles.statusText} numberOfLines={1}>{statusLine}</Text>
              <Text style={styles.statusRight}>{statusRight}</Text>
            </View>

            {/* Booking card */}
            <View style={styles.bookShadow}>
              <View style={styles.book}>
                <ParcelArt />
                <View style={styles.bookTop}>
                  <Text style={styles.bookLabel}>Order</Text>
                  <View style={[styles.bookPill, { backgroundColor: ribbon.bg }]}>
                    <Text style={[styles.bookPillText, { color: ribbon.fg }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.bookNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {order.order_number}
                </Text>

                <TrackRail order={order} />

                <View style={routeStyles.route}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>FROM</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{seller}</Text>
                    <Text style={routeStyles.routeSub}>{shortDate(order.placed_at)}</Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>TO</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{to}</Text>
                    <Text style={routeStyles.routeSub} numberOfLines={1}>
                      {order.status === "delivered"
                        ? `Delivered ${shortDate(order.delivered_at ?? order.placed_at)}`
                        : closed
                          ? tone.label
                          : `Estimated ${shortDate(eta)}`}
                    </Text>
                  </View>
                </View>
                <View style={[routeStyles.route, { marginTop: 14 }]}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>ORDER COST</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>
                      {formatPrice(order.total, order.currency)}
                    </Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>RECIPIENT</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>
                      {ship?.full_name?.split(" ")[0] || "You"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {canTrack ? (
              <TouchableOpacity
                style={styles.trackCta}
                onPress={openTrack}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Open live tracking"
              >
                <View style={styles.trackCtaIcon}>
                  <Ionicons name="navigate" size={16} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackCtaTitle}>Live tracking</Text>
                  <Text style={styles.trackCtaSub}>Follow every step to your door</Text>
                </View>
                <Ionicons name="arrow-forward" size={17} color={C.lime} />
              </TouchableOpacity>
            ) : null}

            {canReturn || canReorder ? (
              <View style={styles.actionRow}>
                {canReturn ? (
                  <TouchableOpacity style={styles.actionBtn} onPress={openReturn} activeOpacity={0.85}>
                    <Ionicons name="return-up-back-outline" size={16} color={C.text} />
                    <Text style={styles.actionBtnText}>Start a return</Text>
                  </TouchableOpacity>
                ) : null}
                {canReorder ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDark]}
                    onPress={handleReorder}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="repeat" size={16} color={C.lime} />
                    <Text style={[styles.actionBtnText, { color: C.cream }]}>Buy again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Payment */}
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>Payment</Text>
                <View
                  style={[
                    styles.payBadge,
                    { backgroundColor: order.payment_status === "paid" ? "rgba(83,94,44,0.12)" : "rgba(200,164,74,0.16)" },
                  ]}
                >
                  <Ionicons
                    name={order.payment_status === "paid" ? "checkmark-circle" : "time"}
                    size={12}
                    color={order.payment_status === "paid" ? C.accent : LUX.goldInk}
                  />
                  <Text
                    style={[
                      styles.payBadgeText,
                      { color: order.payment_status === "paid" ? C.accent : LUX.goldInk },
                    ]}
                  >
                    {(order.payment_status ?? "pending").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.methodRow}>
                <View style={styles.methodIcon}>
                  <Ionicons
                    name={order.payment_method === "cod" ? "cash-outline" : "card-outline"}
                    size={18}
                    color={C.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>
                    {order.payment_method === "cod" ? "Cash on Delivery" : "Online payment"}
                  </Text>
                  <Text style={styles.methodSub}>
                    {order.payment_method === "cod" ? "Pay when your parcel arrives" : "Encrypted & secured"}
                  </Text>
                </View>
              </View>

              <View style={styles.ledger}>
                <LedgerLine label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
                <LedgerLine
                  label="Delivery"
                  value={order.shipping_fee === 0 ? "Free" : formatPrice(order.shipping_fee, order.currency)}
                  accent={order.shipping_fee === 0}
                />
                {order.discount > 0 ? (
                  <LedgerLine label="Discount" value={`-${formatPrice(order.discount, order.currency)}`} accent />
                ) : null}
                <LedgerLine label="Platform fee" value={formatPrice(order.tax, order.currency)} />
                <View style={styles.ledgerTotal}>
                  <Text style={styles.ledgerTotalLabel}>Total</Text>
                  <Text style={styles.ledgerTotalValue}>{formatPrice(order.total, order.currency)}</Text>
                </View>
              </View>

              {showPay ? (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={handleRetryPay}
                  disabled={retryingPay}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Complete payment"
                >
                  {retryingPay ? (
                    <ActivityIndicator size="small" color={C.cream} />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={14} color={C.lime} />
                      <Text style={styles.payBtnText}>Complete payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Delivery address */}
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Delivery address</Text>
              {ship ? (
                <View style={styles.addrRow}>
                  <View style={styles.methodIcon}>
                    <Ionicons name="location" size={18} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.methodTitle}>{ship.full_name}</Text>
                    <Text style={styles.addrText}>
                      {ship.line1}
                      {ship.line2 ? `, ${ship.line2}` : ""}
                    </Text>
                    <Text style={styles.addrText}>
                      {[ship.city, ship.state, ship.postal_code].filter(Boolean).join(", ")}
                    </Text>
                    {ship.phone ? (
                      <View style={styles.phoneChip}>
                        <Ionicons name="call-outline" size={11} color={C.accent} />
                        <Text style={styles.phoneChipText}>{ship.phone}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={styles.addrText}>No delivery address on record.</Text>
              )}
            </View>

            {canCancel ? (
              <TouchableOpacity style={styles.cancelRow} onPress={handleCancelOrder} activeOpacity={0.75}>
                <Ionicons name="close-circle-outline" size={16} color={C.rust} />
                <Text style={styles.cancelText}>Cancel this order</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: Math.max(insets.bottom, 16) + 16 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <MenuSheet open={menuOpen} items={menu} onClose={() => setMenuOpen(false)} bottom={insets.bottom} />
    </View>
  );
}

function LedgerLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.ledgerLine}>
      <Text style={styles.ledgerLabel}>{label}</Text>
      <Text style={[styles.ledgerValue, accent && { color: C.accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },

  loadingContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },
  retryBtn: { marginTop: 4, height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: C.ink, justifyContent: "center" },
  retryBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.cream },

  scroll: { flexGrow: 1, paddingTop: 6 },

  itemsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  itemsKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  itemsCount: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },

  itemsCard: {
    marginHorizontal: 20,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  itemThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1, minWidth: 0, gap: 2 },
  itemBrand: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.4, color: C.accent },
  itemName: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  itemPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  variantChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    maxWidth: 140,
  },
  variantChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
  unitText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  cancelPiece: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.rust },
  strike: { textDecorationLine: "line-through", opacity: 0.6 },

  sheet: {
    flex: 1,
    marginTop: 22,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 8,
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#e2e0d6", marginBottom: 16 },

  sellerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.goldSoft,
  },
  sellerInitial: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: C.goldSoft },
  sellerMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  sellerKicker: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted, marginRight: 4 },
  sellerVerified: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },
  sellerName: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.text, marginTop: 1 },
  roundDark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#efede4",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  statusRight: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },

  bookShadow: {
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  book: {
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  bookTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  bookPill: { height: 30, paddingHorizontal: 14, borderRadius: 15, justifyContent: "center" },
  bookPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5 },
  bookNumber: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: C.text,
  },

  trackCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  trackCtaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  trackCtaTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  trackCtaSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
  },
  actionBtnDark: { backgroundColor: C.ink, borderColor: C.ink },
  actionBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },

  block: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#faf9f4",
    borderWidth: 1,
    borderColor: C.line,
  },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: -0.2, color: C.text },
  payBadge: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13 },
  payBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.text },
  methodSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },
  ledger: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line, borderStyle: "dashed", gap: 10 },
  ledgerLine: { flexDirection: "row", justifyContent: "space-between" },
  ledgerLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  ledgerValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text, fontVariant: ["tabular-nums"] },
  ledgerTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  ledgerTotalLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text },
  ledgerTotalValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  payBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
  },
  payBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },

  addrRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  addrText: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: C.muted },
  phoneChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
  },
  phoneChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },

  cancelRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
  },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.rust },

});
