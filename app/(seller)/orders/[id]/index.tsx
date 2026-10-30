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
  Linking,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { getSellerStore, getSellerOrderById, transitionOrderStatus, cancelOrder } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { canSellerCancelOrder, getSellerAdvanceStatus } from "@/lib/order-lifecycle";
import { isExternalCourierEnabledMobile } from "@/lib/feature-flags";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import {
  formatCheckoutPayment,
  formatOrderStatusLabel,
  formatPaymentStatus,
  readShippingAddress,
} from "@/lib/orders/seller-list";
import { Skeleton } from "@/components/ui/Skeleton";
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
import { LUX } from "@/components/orders/luxe-order";
import type { Order, OrderStatus } from "@/lib/types";

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok || !storeRes.data) {
      setLoadError(storeRes.ok ? "No store found" : storeRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setStoreName(storeRes.data.name ?? null);
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(seller)/orders" as never);
  };

  const handleTransition = async (nextStatus: OrderStatus) => {
    if (!order) return;
    Alert.alert(
      "Update status?",
      `Mark order as "${formatOrderStatusLabel(nextStatus)}"?`,
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

  if (loading || !order) {
    const friendlyError =
      !loadError
        ? null
        : /more than one relationship|upstream:|PGRST/i.test(loadError)
          ? "Something went wrong loading this order. Please try again."
          : loadError;
    return (
      <View style={styles.root}>
        <LinearGradient
          pointerEvents="none"
          colors={[C.glow, C.glowSoft, C.paper]}
          locations={[0, 0.55, 1]}
          style={styles.glow}
        />
        <SafeAreaView style={styles.flex} edges={["top"]}>
          <DetailTopBar title="Order Details" onBack={goBack} />
          <View style={styles.loadingContainer}>
            {!loading ? (
              <>
                <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
                <Text style={styles.loadingTitle}>Couldn’t load this order</Text>
                <Text style={styles.loadingText}>{friendlyError ?? "Order not found"}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.85}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ width: "100%", gap: 14 }}>
                <Skeleton height={180} borderRadius={24} />
                <Skeleton height={64} borderRadius={20} />
                <Skeleton height={300} borderRadius={26} />
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const items = order.items ?? [];
  const ribbon = RIBBON[order.status] ?? RIBBON.pending;
  const closed = CLOSED.includes(order.status);
  const canRefund = order.status === "delivered" || order.status === "processing";
  const canCancel = canSellerCancelOrder(order.status);
  const nextStatus = getSellerAdvanceStatus(order.status);
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0);
  // Sellers see their products only — buyer-side fees and delivery stay off this screen.
  const itemsTotal = items.reduce((s, i) => s + i.total, 0);
  const isPaid = order.payment_status === "paid";
  const codUnpaid = order.payment_method === "cod" && !isPaid;
  const ship = readShippingAddress(order);
  const customer = ship?.name || "Customer";
  const to = ship ? [ship.city, ship.region].filter(Boolean).join(", ") || ship.line1 || customer : customer;
  const eta = etaFor(order).eta;
  const showActionBar = !!nextStatus || canRefund;

  let statusLine: string;
  if (order.status === "delivered") statusLine = `Delivered ${shortDate(order.delivered_at ?? order.placed_at)}`;
  else if (closed) statusLine = formatOrderStatusLabel(order.status);
  else if (nextStatus) statusLine = `Next: mark as ${formatOrderStatusLabel(nextStatus).toLowerCase()}`;
  else if (isExternalCourierEnabledMobile()) statusLine = `${formatOrderStatusLabel(order.status)} · updates from courier`;
  else statusLine = formatOrderStatusLabel(order.status);
  const statusRight = closed || order.status === "delivered" ? `${itemsCount} item${itemsCount === 1 ? "" : "s"}` : `Est. ${shortDate(eta)}`;

  const copyOrderNumber = async () => {
    if (!order.order_number) return;
    await Clipboard.setStringAsync(order.order_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const openInvoice = () => router.push(`/(seller)/orders/${order.id}/invoice` as never);
  const callCustomer = ship?.phone ? () => void Linking.openURL(`tel:${ship.phone}`) : null;

  const menu: MenuItem[] = [
    { icon: "copy-outline", label: "Copy order number", onPress: () => void copyOrderNumber() },
    { icon: "document-text-outline", label: "Customer invoice", onPress: openInvoice },
    ...(callCustomer ? [{ icon: "call-outline" as const, label: "Call customer", onPress: callCustomer }] : []),
    ...(canRefund && nextStatus
      ? [{ icon: "return-down-back-outline" as const, label: "Refund order", onPress: openRefundDialog, danger: true }]
      : []),
    ...(canCancel
      ? [{ icon: "close-circle-outline" as const, label: "Cancel order", onPress: handleCancel, danger: true }]
      : []),
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.glow}
      />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <DetailTopBar title="Order Details" onBack={goBack} onMore={() => setMenuOpen(true)} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          <View style={styles.itemsHead}>
            <Text style={styles.itemsKicker}>IN THIS PARCEL</Text>
            <Text style={styles.itemsCount}>
              {itemsCount} unit{itemsCount === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.itemsCard}>
            {items.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(i * 60).duration(380)}
                style={[styles.itemRow, i > 0 && styles.itemRowDivider]}
              >
                <View style={styles.itemThumb}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="shirt-outline" size={22} color={C.muted} />
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemSku} numberOfLines={1}>
                    {formatPrice(item.unit_price, order.currency)} EACH
                  </Text>
                  <Text style={[styles.itemName, item.status === "cancelled" && styles.strike]} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <View style={styles.itemMeta}>
                    {item.variant_label ? (
                      <View style={styles.variantChip}>
                        <Text style={styles.variantChipText} numberOfLines={1}>{item.variant_label}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.unitText}>Qty {item.quantity}</Text>
                    {item.status === "cancelled" ? <Text style={styles.cancelPiece}>Cancelled</Text> : null}
                  </View>
                </View>
                <Text style={[styles.itemPrice, item.status === "cancelled" && styles.strike]}>
                  {formatPrice(item.total, order.currency)}
                </Text>
              </Animated.View>
            ))}
          </View>

          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.personRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{customer.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.personKicker}>Customer</Text>
                <Text style={styles.personName} numberOfLines={1}>{customer}</Text>
              </View>
              <TouchableOpacity
                style={styles.roundDark}
                onPress={openInvoice}
                activeOpacity={0.85}
                accessibilityLabel="Customer invoice"
              >
                <Ionicons name="document-text-outline" size={18} color={C.cream} />
              </TouchableOpacity>
              {callCustomer ? (
                <TouchableOpacity
                  style={styles.roundDark}
                  onPress={callCustomer}
                  activeOpacity={0.85}
                  accessibilityLabel="Call customer"
                >
                  <Ionicons name="call" size={17} color={C.cream} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.statusBar}>
              <View style={[styles.statusDot, { backgroundColor: closed ? C.rust : C.ink }]} />
              <Text style={styles.statusText} numberOfLines={1}>{statusLine}</Text>
              <Text style={styles.statusRight}>{statusRight}</Text>
            </View>

            <View style={styles.bookShadow}>
              <View style={styles.book}>
                <ParcelArt />
                <View style={styles.bookTop}>
                  <Text style={styles.bookLabel}>Order</Text>
                  <View style={[styles.bookPill, { backgroundColor: ribbon.bg }]}>
                    <Text style={[styles.bookPillText, { color: ribbon.fg }]}>{formatOrderStatusLabel(order.status)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.bookNumberRow}
                  onPress={() => void copyOrderNumber()}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Copy order number ${order.order_number}`}
                >
                  <Text style={styles.bookNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {order.order_number}
                  </Text>
                  <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={16} color={copied ? C.accent : C.muted} />
                </TouchableOpacity>

                <TrackRail order={order} />

                <View style={routeStyles.route}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>FROM</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{storeName || "Your store"}</Text>
                    <Text style={routeStyles.routeSub}>{shortDate(order.placed_at)}</Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>TO</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{to}</Text>
                    <Text style={routeStyles.routeSub} numberOfLines={1}>
                      {order.status === "delivered"
                        ? `Delivered ${shortDate(order.delivered_at ?? order.placed_at)}`
                        : closed
                          ? formatOrderStatusLabel(order.status)
                          : `Estimated ${shortDate(eta)}`}
                    </Text>
                  </View>
                </View>
                <View style={[routeStyles.route, { marginTop: 14 }]}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>YOUR ITEMS</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>
                      {formatPrice(itemsTotal, order.currency)}
                    </Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>RECIPIENT</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{customer.split(" ")[0]}</Text>
                  </View>
                </View>
              </View>
            </View>

            {codUnpaid ? (
              <View style={styles.codBanner}>
                <Ionicons name="cash-outline" size={18} color={C.rust} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.codTitle}>Cash on delivery</Text>
                  <Text style={styles.codBody}>
                    The customer pays in cash at delivery. Once it is collected, the order can be marked through its status flow.
                  </Text>
                </View>
              </View>
            ) : null}

            {order.notes ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Customer note</Text>
                <View style={styles.noteRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.accent} style={{ marginTop: 2 }} />
                  <Text style={styles.noteText}>{order.notes}</Text>
                </View>
              </View>
            ) : null}

            {/* Payment */}
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>Payment</Text>
                <View
                  style={[
                    styles.payBadge,
                    { backgroundColor: isPaid ? "rgba(83,94,44,0.12)" : codUnpaid ? "rgba(184,92,58,0.1)" : "rgba(200,164,74,0.16)" },
                  ]}
                >
                  <Ionicons
                    name={isPaid ? "checkmark-circle" : "time"}
                    size={12}
                    color={isPaid ? C.accent : codUnpaid ? C.rust : LUX.goldInk}
                  />
                  <Text
                    style={[
                      styles.payBadgeText,
                      { color: isPaid ? C.accent : codUnpaid ? C.rust : LUX.goldInk },
                    ]}
                  >
                    {formatPaymentStatus(order.payment_status).toUpperCase()}
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
                  <Text style={styles.methodTitle}>{formatCheckoutPayment(order.payment_method)}</Text>
                  <Text style={styles.methodSub}>Placed {formatDateTime(order.placed_at)}</Text>
                </View>
              </View>

              <View style={styles.ledger}>
                {items.map((item) => (
                  <LedgerLine
                    key={item.id}
                    label={`${item.product_name} × ${item.quantity}`}
                    value={formatPrice(item.total, order.currency)}
                  />
                ))}
                <View style={styles.ledgerTotal}>
                  <Text style={styles.ledgerTotalLabel}>Your items</Text>
                  <Text style={styles.ledgerTotalValue}>{formatPrice(itemsTotal, order.currency)}</Text>
                </View>
              </View>
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
                    <Text style={styles.methodTitle}>{customer}</Text>
                    {ship.line1 ? (
                      <Text style={styles.addrText}>
                        {ship.line1}
                        {ship.line2 ? `, ${ship.line2}` : ""}
                      </Text>
                    ) : null}
                    <Text style={styles.addrText}>
                      {[ship.city, ship.region, ship.postalCode].filter(Boolean).join(", ")}
                    </Text>
                    {ship.phone ? (
                      <TouchableOpacity style={styles.phoneChip} onPress={callCustomer ?? undefined} activeOpacity={0.8}>
                        <Ionicons name="call-outline" size={11} color={C.accent} />
                        <Text style={styles.phoneChipText}>{ship.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={[styles.addrText, { marginTop: 8 }]}>No delivery address on record.</Text>
              )}
            </View>

            {canCancel && !nextStatus ? (
              <TouchableOpacity style={styles.cancelRow} onPress={handleCancel} activeOpacity={0.75}>
                <Ionicons name="close-circle-outline" size={16} color={C.rust} />
                <Text style={styles.cancelText}>Cancel this order</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: showActionBar ? 110 : Math.max(insets.bottom, 16) + 16 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {showActionBar ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
                <Text style={styles.primaryActionText}>
                  {updating ? "Working…" : `Mark as ${formatOrderStatusLabel(nextStatus).toLowerCase()}`}
                </Text>
              </View>
              {updating ? null : (
                <View style={styles.primaryActionArrow}>
                  <Ionicons name="arrow-forward" size={18} color={C.ink} />
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
              <Ionicons name="return-down-back-outline" size={17} color={C.rust} />
              <Text style={styles.refundActionText}>Refund order</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

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
              placeholderTextColor={C.muted}
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

      <MenuSheet open={menuOpen} items={menu} onClose={() => setMenuOpen(false)} bottom={insets.bottom} />
    </View>
  );
}

function LedgerLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ledgerLine}>
      <Text style={styles.ledgerLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.ledgerValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },

  loadingContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  loadingTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted, textAlign: "center" },
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
  itemSku: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.2, color: C.accent },
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

  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.goldSoft,
  },
  avatarInitial: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: C.goldSoft },
  personKicker: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
  personName: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.text, marginTop: 1 },
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
  bookNumberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bookNumber: {
    flexShrink: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: C.text,
  },

  codBanner: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.24)",
    borderRadius: 20,
    padding: 14,
  },
  codTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.rust },
  codBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 17 },

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
  noteRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  noteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: C.text },
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
  ledgerLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ledgerLabel: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
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

  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  actionBarTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.72)" },
  primaryAction: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 30, backgroundColor: C.ink, paddingLeft: 24, paddingRight: 7, shadowColor: "#16150F", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  primaryActionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.6, color: C.lime, marginBottom: 2 },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: C.cream },
  primaryActionArrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" },
  refundAction: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 27, borderWidth: 1, borderColor: "rgba(184,92,58,0.3)", backgroundColor: "rgba(184,92,58,0.05)" },
  refundActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: C.rust },
  actionDisabled: { opacity: 0.6 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 26, padding: 20, borderWidth: 1, borderColor: C.line },
  modalTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, marginBottom: 6 },
  modalBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted, marginBottom: 12, lineHeight: 20 },
  modalInput: {
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#faf9f4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
  modalBtn: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  modalBtnCancel: { backgroundColor: C.accentSoft },
  modalBtnCancelText: { fontFamily: fontFamilies.sans.semibold, color: C.text, fontSize: 14 },
  modalBtnConfirm: { backgroundColor: C.rust },
  modalBtnConfirmText: { fontFamily: fontFamilies.sans.semibold, color: "#fff", fontSize: 14 },
});
