import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminStoreDetail, getOrderById, transitionOrderStatus } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";
import { getSellerNextStatus } from "@/lib/order-lifecycle";
import {
  formatCheckoutPayment,
  formatOrderStatusLabel,
  formatPaymentStatus,
  readShippingAddress,
  isOrderReceivedBySeller,
} from "@/lib/orders/seller-list";
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
import { MenuSheet, type MenuItem } from "@/components/orders/detail-chrome";
import { LUX } from "@/components/orders/luxe-order";
import { themedAlert } from "@/lib/themed-alert";

const CANCELLABLE: OrderStatus[] = ["pending", "confirmed", "processing"];
const REFUNDABLE: OrderStatus[] = ["processing", "delivered"];

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
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

function storeNameOf(order: Order): string | null {
  for (const it of order.items ?? []) {
    const name = (it as unknown as { store?: { name?: string | null } | null }).store?.name;
    if (name) return name;
  }
  return null;
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<null | "refunded" | "cancelled">(null);
  const [reason, setReason] = useState("");

  const orderQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await getOrderById(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (vars: { status: string; reason?: string }) =>
      transitionOrderStatus(id!, vars.status, { reason: vars.reason, skipClientGuard: true, adminOverride: true }),
    onSuccess: (res) => {
      if (!res.ok) {
        themedAlert("Couldn't update status", res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => themedAlert("Couldn't update status", e instanceof Error ? e.message : "Try again."),
  });

  const senderStoreId = orderQuery.data
    ? orderQuery.data.items?.[0]?.store_id ?? (orderQuery.data as unknown as { store_id?: string }).store_id ?? null
    : null;
  const senderQuery = useQuery({
    queryKey: ["admin-order-sender", senderStoreId],
    queryFn: async () => {
      const res = await getAdminStoreDetail(senderStoreId!);
      if (!res.ok) throw new Error(res.error);
      return res.data?.store ?? null;
    },
    enabled: !!senderStoreId,
    staleTime: 5 * 60_000,
  });

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(admin)/orders" as never);
  };

  const copy = async (key: string, value?: string | null) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const order = orderQuery.data;
  const updating = transitionMutation.isPending;

  if (orderQuery.isLoading || !order) {
    const err = orderQuery.error instanceof Error ? orderQuery.error.message : null;
    const friendly = err && /more than one relationship|upstream:|PGRST/i.test(err)
      ? "Something went wrong loading this order. Please try again."
      : err;
    return (
      <View style={styles.root}>
        <LinearGradient pointerEvents="none" colors={[C.paper, C.glow, C.glowSoft, C.paper]} locations={[0, 0.18, 0.6, 1]} style={styles.glow} />
        <Header onBack={goBack} />
        <View style={styles.loadingContainer}>
          {orderQuery.isLoading ? (
            <View style={{ width: "100%", gap: 14 }}>
              <Skeleton height={180} borderRadius={24} />
              <Skeleton height={64} borderRadius={20} />
              <Skeleton height={300} borderRadius={26} />
            </View>
          ) : (
            <>
              <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
              <Text style={styles.loadingTitle}>Couldn’t load this order</Text>
              <Text style={styles.loadingText}>{friendly ?? "This order may have been removed or the link is out of date."}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => orderQuery.refetch()} activeOpacity={0.85}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  const items = order.items ?? [];
  const ribbon = RIBBON[order.status] ?? RIBBON.pending;
  const closed = CLOSED.includes(order.status);
  const nextStatus = getSellerNextStatus(order.status as OrderStatus);
  const canCancel = CANCELLABLE.includes(order.status);
  const canRefund = REFUNDABLE.includes(order.status);
  const isReceived = isOrderReceivedBySeller(order);
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0);
  const isPaid = order.payment_status === "paid";
  const codUnpaid = order.payment_method === "cod" && !isPaid;
  const ship = readShippingAddress(order);
  const customer = ship?.name || "Customer";
  const phone = ship?.phone || null;
  const storeName = storeNameOf(order);
  const storeId = items[0]?.store_id ?? (order as unknown as { store_id?: string }).store_id ?? null;
  const to = ship ? [ship.city, ship.region].filter(Boolean).join(", ") || ship.line1 || customer : customer;
  const eta = etaFor(order).eta;
  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const groupId = typeof meta.group_id === "string" ? meta.group_id : null;
  const couponCode = typeof meta.coupon_code === "string" ? meta.coupon_code : null;
  const hasFailure =
    order.failure_reason || order.failed_at || order.attempt_count || order.failure_notes || order.failure_evidence_url;
  const showActionBar = !!nextStatus || canRefund;

  let statusLine: string;
  if (order.status === "delivered") statusLine = `Delivered ${shortDate(order.delivered_at ?? order.placed_at)}`;
  else if (closed) statusLine = formatOrderStatusLabel(order.status);
  else if (nextStatus) statusLine = `Next: ${formatOrderStatusLabel(nextStatus).toLowerCase()}`;
  else statusLine = `${formatOrderStatusLabel(order.status)} · updates from delivery company`;
  const statusRight = closed || order.status === "delivered" ? `${itemsCount} item${itemsCount === 1 ? "" : "s"}` : `Est. ${shortDate(eta)}`;

  const advance = () => {
    if (!nextStatus) return;
    themedAlert(`Mark as ${formatOrderStatusLabel(nextStatus)}?`, "This force-overrides the order status and is logged to the audit trail.", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => transitionMutation.mutate({ status: nextStatus }) },
    ]);
  };

  const closeReason = () => {
    setReasonModal(null);
    setReason("");
  };

  const submitReason = () => {
    if (!reasonModal) return;
    const status = reasonModal;
    const r = reason.trim() || (status === "refunded" ? "Admin refund" : "Admin cancellation");
    closeReason();
    transitionMutation.mutate({ status, reason: r });
  };

  const dial = (num?: string | null) => {
    if (num) void Linking.openURL(`tel:${num.replace(/\s+/g, "")}`);
  };
  const callCustomer = () => dial(phone);

  const sender = senderQuery.data ?? null;
  const senderOwner = sender?.owner ?? null;
  const pickupPhone = sender?.delivery_phone || senderOwner?.phone || null;
  const storePhone = sender?.contact_phone && sender.contact_phone !== pickupPhone ? sender.contact_phone : null;
  const storeEmail = sender?.contact_email || null;
  const ownerEmail = senderOwner?.email && senderOwner.email !== storeEmail ? senderOwner.email : null;
  const senderLine1 = [sender?.delivery_address_line1, sender?.delivery_address_line2].filter(Boolean).join(", ");
  const senderLine2 = [sender?.delivery_city, sender?.delivery_state, sender?.delivery_postal_code].filter(Boolean).join(", ");
  const senderCity = sender?.delivery_city || null;

  const menu: MenuItem[] = [
    { icon: "copy-outline", label: "Copy order number", onPress: () => void copy("number", order.order_number) },
    { icon: "finger-print-outline", label: "Copy order ID", onPress: () => void copy("id", order.id) },
    ...(phone ? [{ icon: "call-outline" as const, label: "Call customer", onPress: callCustomer }] : []),
    ...(pickupPhone ? [{ icon: "call-outline" as const, label: "Call seller", onPress: () => dial(pickupPhone) }] : []),
    ...(storeId
      ? [{ icon: "storefront-outline" as const, label: "View store", onPress: () => router.push(`/(admin)/stores/${storeId}` as never) }]
      : []),
    ...(nextStatus
      ? [{ icon: "arrow-forward-circle-outline" as const, label: `Mark as ${formatOrderStatusLabel(nextStatus)}`, onPress: advance }]
      : []),
    ...(canRefund
      ? [{ icon: "return-down-back-outline" as const, label: "Refund order", onPress: () => setReasonModal("refunded"), danger: true }]
      : []),
    ...(canCancel
      ? [{ icon: "close-circle-outline" as const, label: "Cancel order", onPress: () => setReasonModal("cancelled"), danger: true }]
      : []),
  ];

  return (
    <View style={styles.root}>
      <LinearGradient pointerEvents="none" colors={[C.paper, C.glow, C.glowSoft, C.paper]} locations={[0, 0.18, 0.6, 1]} style={styles.glow} />
      <Header onBack={goBack} onMore={() => setMenuOpen(true)} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={orderQuery.isFetching && !orderQuery.isLoading} onRefresh={() => orderQuery.refetch()} tintColor={C.accent} />
        }
      >
        <View style={styles.itemsHead}>
          <Text style={styles.itemsKicker}>IN THIS PARCEL</Text>
          <Text style={styles.itemsCount}>
            {itemsCount} unit{itemsCount === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.itemsCard}>
          {items.map((item, i) => {
            const img = itemImage(item);
            const cancelled = item.status === "cancelled";
            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(i * 60).duration(380)}
                style={[styles.itemRow, i > 0 && styles.itemRowDivider]}
              >
                <View style={styles.itemThumb}>
                  {img ? (
                    <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="shirt-outline" size={22} color={C.muted} />
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemSku} numberOfLines={1}>
                    {formatPrice(item.unit_price ?? item.total / Math.max(1, item.quantity), order.currency)} EACH
                  </Text>
                  <Text style={[styles.itemName, cancelled && styles.strike]} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <View style={styles.itemMeta}>
                    {item.variant_label ? (
                      <View style={styles.variantChip}>
                        <Text style={styles.variantChipText} numberOfLines={1}>{item.variant_label}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.unitText}>Qty {item.quantity}</Text>
                    {cancelled ? <Text style={styles.cancelPiece}>Cancelled</Text> : null}
                  </View>
                </View>
                <Text style={[styles.itemPrice, cancelled && styles.strike]}>{formatPrice(item.total, order.currency)}</Text>
              </Animated.View>
            );
          })}
          {items.length === 0 ? <Text style={styles.noItems}>Item details aren't available for this order.</Text> : null}
        </View>

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {/* Customer */}
          <View style={styles.personRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{customer.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.personKicker}>Customer</Text>
              <Text style={styles.personName} numberOfLines={1}>{customer}</Text>
            </View>
            {phone ? (
              <TouchableOpacity style={styles.roundDark} onPress={callCustomer} activeOpacity={0.85} accessibilityLabel="Call customer">
                <Ionicons name="call-outline" size={18} color={C.cream} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Store */}
          {storeName || storeId ? (
            <TouchableOpacity
              style={[styles.personRow, styles.storeRow]}
              activeOpacity={storeId ? 0.75 : 1}
              disabled={!storeId}
              onPress={() => storeId && router.push(`/(admin)/stores/${storeId}` as never)}
            >
              <View style={styles.storeIcon}>
                <Ionicons name="storefront-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.personKicker}>Seller</Text>
                <Text style={styles.storeName} numberOfLines={1}>{storeName ?? shortId(storeId)}</Text>
              </View>
              {storeId ? <Ionicons name="chevron-forward" size={16} color={C.faint} /> : null}
            </TouchableOpacity>
          ) : null}

          <View style={styles.statusBar}>
            <View style={[styles.statusDot, { backgroundColor: closed ? C.rust : C.ink }]} />
            <Text style={styles.statusText} numberOfLines={1}>{statusLine}</Text>
            <Text style={styles.statusRight}>{statusRight}</Text>
          </View>

          {/* Parcel book */}
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
                onPress={() => void copy("number", order.order_number)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Copy order number ${order.order_number}`}
              >
                <Text style={styles.bookNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {order.order_number}
                </Text>
                <Ionicons
                  name={copied === "number" ? "checkmark-circle" : "copy-outline"}
                  size={16}
                  color={copied === "number" ? C.accent : C.muted}
                />
              </TouchableOpacity>

              <TrackRail order={order} />

              <View style={routeStyles.route}>
                <View style={routeStyles.routeCol}>
                  <Text style={routeStyles.routeLabel}>FROM</Text>
                  <Text style={routeStyles.routeValue} numberOfLines={1}>{storeName || "Store"}</Text>
                  <Text style={routeStyles.routeSub} numberOfLines={1}>
                    {senderCity ? `${senderCity} · ${shortDate(order.placed_at)}` : shortDate(order.placed_at)}
                  </Text>
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
                  <Text style={routeStyles.routeLabel}>ORDER TOTAL</Text>
                  <Text style={routeStyles.routeValue} numberOfLines={1}>{formatPrice(order.total, order.currency)}</Text>
                </View>
                <View style={routeStyles.routeCol}>
                  <Text style={routeStyles.routeLabel}>RECIPIENT</Text>
                  <Text style={routeStyles.routeValue} numberOfLines={1}>{customer.split(" ")[0]}</Text>
                </View>
              </View>
            </View>
          </View>

          {isReceived ? (
            <View style={styles.receivedBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
              <View style={{ flex: 1 }}>
                <Text style={styles.receivedBannerTitle}>Seller marked received</Text>
                <Text style={styles.receivedBannerBody}>
                  Acknowledged by the store · {formatDateTime(order.seller_processed_at || (meta.seller_processed_at as string) || null)}
                </Text>
              </View>
            </View>
          ) : null}

          {codUnpaid ? (
            <View style={styles.codBanner}>
              <Ionicons name="cash-outline" size={18} color={C.rust} />
              <View style={{ flex: 1 }}>
                <Text style={styles.codTitle}>Collect {formatPrice(order.total, order.currency)} on delivery</Text>
                <Text style={styles.codBody}>Payment has not been captured for this order yet.</Text>
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
                <Ionicons name={isPaid ? "checkmark-circle" : "time"} size={12} color={isPaid ? C.accent : codUnpaid ? C.rust : LUX.goldInk} />
                <Text style={[styles.payBadgeText, { color: isPaid ? C.accent : codUnpaid ? C.rust : LUX.goldInk }]}>
                  {formatPaymentStatus(order.payment_status).toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.methodRow}>
              <View style={styles.methodIcon}>
                <Ionicons name={order.payment_method === "cod" ? "cash-outline" : "card-outline"} size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>{formatCheckoutPayment(order.payment_method)}</Text>
                <Text style={styles.methodSub}>Placed {formatDateTime(order.placed_at)}</Text>
              </View>
            </View>

            <View style={styles.ledger}>
              {items.map((item) => (
                <LedgerLine key={item.id} label={`${item.product_name} × ${item.quantity}`} value={formatPrice(item.total, order.currency)} />
              ))}
              <View style={styles.ledgerRule} />
              <LedgerLine label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
              {order.discount > 0 ? (
                <LedgerLine
                  label={couponCode ? `Discount (${couponCode})` : "Discount"}
                  value={`−${formatPrice(order.discount, order.currency)}`}
                  accent
                />
              ) : null}
              <LedgerLine label="Delivery" value={formatPrice(order.shipping_fee, order.currency)} />
              <LedgerLine label="Platform fee" value={formatPrice(order.tax, order.currency)} />
              <View style={styles.ledgerTotal}>
                <Text style={styles.ledgerTotalLabel}>Order total</Text>
                <Text style={styles.ledgerTotalValue}>{formatPrice(order.total, order.currency)}</Text>
              </View>
            </View>
          </View>

          {/* Sender */}
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text style={styles.blockTitle}>Sender</Text>
              {sender?.is_suspended ? (
                <View style={[styles.payBadge, { backgroundColor: "rgba(184,92,58,0.1)" }]}>
                  <Text style={[styles.payBadgeText, { color: C.rust }]}>SUSPENDED</Text>
                </View>
              ) : null}
            </View>
            {senderQuery.isLoading ? (
              <View style={{ marginTop: 14, gap: 8 }}>
                <Skeleton height={42} borderRadius={14} />
                <Skeleton height={16} borderRadius={8} />
              </View>
            ) : !sender ? (
              <Text style={[styles.addrText, { marginTop: 8 }]}>
                {senderQuery.isError ? "Couldn't load seller details." : "No seller on record."}
              </Text>
            ) : (
              <>
                <View style={styles.addrRow}>
                  <View style={[styles.methodIcon, { overflow: "hidden" }]}>
                    {sender.logo_url ? (
                      <Image source={{ uri: resolveImageUrl(sender.logo_url) || sender.logo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Ionicons name="storefront" size={18} color={C.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.methodTitle}>{sender.name ?? storeName ?? "Store"}</Text>
                    {senderOwner?.full_name ? <Text style={styles.addrText}>Owner · {senderOwner.full_name}</Text> : null}
                  </View>
                </View>

                <View style={styles.addrRow}>
                  <View style={styles.methodIcon}>
                    <Ionicons name="location" size={18} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.senderKicker}>PICKUP ADDRESS</Text>
                    {senderLine1 || senderLine2 ? (
                      <>
                        {senderLine1 ? <Text style={styles.addrText}>{senderLine1}</Text> : null}
                        {senderLine2 ? <Text style={styles.addrText}>{senderLine2}</Text> : null}
                        {sender.delivery_country ? <Text style={styles.addrText}>{sender.delivery_country}</Text> : null}
                      </>
                    ) : (
                      <Text style={[styles.addrText, { color: C.rust }]}>No pickup address set</Text>
                    )}
                  </View>
                </View>

                <View style={styles.contactWrap}>
                  {pickupPhone ? (
                    <TouchableOpacity style={styles.phoneChip} onPress={() => dial(pickupPhone)} activeOpacity={0.8}>
                      <Ionicons name="call" size={12} color={colors.olive[800]} />
                      <Text style={styles.phoneChipText}>{pickupPhone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {storePhone ? (
                    <TouchableOpacity style={styles.phoneChip} onPress={() => dial(storePhone)} activeOpacity={0.8}>
                      <Ionicons name="call-outline" size={12} color={colors.olive[800]} />
                      <Text style={styles.phoneChipText}>{storePhone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {storeEmail ? (
                    <TouchableOpacity style={styles.phoneChip} onPress={() => void Linking.openURL(`mailto:${storeEmail}`)} activeOpacity={0.8}>
                      <Ionicons name="mail" size={12} color={colors.olive[800]} />
                      <Text style={styles.phoneChipText} numberOfLines={1}>{storeEmail}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {ownerEmail ? (
                    <TouchableOpacity style={styles.phoneChip} onPress={() => void Linking.openURL(`mailto:${ownerEmail}`)} activeOpacity={0.8}>
                      <Ionicons name="mail-outline" size={12} color={colors.olive[800]} />
                      <Text style={styles.phoneChipText} numberOfLines={1}>{ownerEmail}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {!pickupPhone && !storePhone && !storeEmail && !ownerEmail ? (
                    <Text style={[styles.addrText, { color: C.rust }]}>No seller contact on record</Text>
                  ) : null}
                </View>
              </>
            )}
          </View>

          {/* Delivery address */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Recipient</Text>
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
                  <Text style={styles.addrText}>{[ship.city, ship.region, ship.postalCode].filter(Boolean).join(", ")}</Text>
                  {phone ? (
                    <TouchableOpacity style={styles.phoneChip} onPress={callCustomer} activeOpacity={0.8}>
                      <Ionicons name="call" size={12} color={colors.olive[800]} />
                      <Text style={styles.phoneChipText}>{phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.addrText, { marginTop: 8 }]}>No delivery address on record.</Text>
            )}
          </View>

          {/* Courier + fulfilment */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Fulfilment</Text>
            <View style={styles.ledger}>
              <LedgerLine label="Status" value={formatOrderStatusLabel(order.status)} />
              {order.courier_status ? <LedgerLine label="Courier status" value={order.courier_status.replace(/_/g, " ")} /> : null}
              {order.courier_shipment_id ? (
                <CopyLine
                  label="Shipment ID"
                  value={order.courier_shipment_id}
                  copied={copied === "shipment"}
                  onCopy={() => void copy("shipment", order.courier_shipment_id)}
                />
              ) : null}
              {order.delivery_person_id ? <LedgerLine label="Rider" value={shortId(order.delivery_person_id)} /> : null}
              {order.handoff_at ? <LedgerLine label="Rider handoff" value={formatDateTime(order.handoff_at)} /> : null}
              {order.route_id ? <LedgerLine label="Route" value={shortId(order.route_id)} /> : null}
              <LedgerLine label="Seller acknowledged" value={isReceived ? "Yes" : "Not yet"} />
              {order.delivered_at ? <LedgerLine label="Delivered" value={formatDateTime(order.delivered_at)} /> : null}
              <LedgerLine label="Last updated" value={formatDateTime(order.updated_at ?? order.placed_at)} />
            </View>
          </View>

          {/* Failure history */}
          {hasFailure ? (
            <View style={[styles.block, styles.blockWarn]}>
              <View style={styles.blockHead}>
                <Text style={[styles.blockTitle, { color: C.rust }]}>Delivery issue</Text>
                <Ionicons name="warning-outline" size={18} color={C.rust} />
              </View>
              <View style={styles.ledger}>
                {order.failure_reason ? <LedgerLine label="Reason" value={String(order.failure_reason).replace(/_/g, " ")} /> : null}
                {order.failure_notes ? <LedgerLine label="Notes" value={order.failure_notes} /> : null}
                {order.failed_at ? <LedgerLine label="Failed at" value={formatDateTime(order.failed_at)} /> : null}
                {order.attempt_count != null ? <LedgerLine label="Attempts" value={String(order.attempt_count)} /> : null}
                {order.reschedule_count != null ? <LedgerLine label="Reschedules" value={String(order.reschedule_count)} /> : null}
                {order.next_retry_at ? <LedgerLine label="Next retry" value={formatDateTime(order.next_retry_at)} /> : null}
              </View>
              {order.failure_evidence_url ? (
                <TouchableOpacity onPress={() => void Linking.openURL(order.failure_evidence_url!)} activeOpacity={0.85}>
                  <Image source={{ uri: order.failure_evidence_url }} style={styles.evidence} contentFit="cover" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Record */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Record</Text>
            <View style={styles.ledger}>
              <CopyLine label="Order ID" value={order.id} copied={copied === "id"} onCopy={() => void copy("id", order.id)} />
              <CopyLine label="Customer ID" value={order.user_id} copied={copied === "user"} onCopy={() => void copy("user", order.user_id)} />
              {storeId ? <CopyLine label="Store ID" value={storeId} copied={copied === "store"} onCopy={() => void copy("store", storeId)} /> : null}
              {groupId ? <CopyLine label="Basket group" value={groupId} copied={copied === "group"} onCopy={() => void copy("group", groupId)} /> : null}
              <LedgerLine label="Currency" value={order.currency} />
            </View>
          </View>

          {canCancel ? (
            <TouchableOpacity style={styles.cancelRow} onPress={() => setReasonModal("cancelled")} activeOpacity={0.75} disabled={updating}>
              <Ionicons name="close-circle-outline" size={16} color={C.rust} />
              <Text style={styles.cancelText}>Cancel this order</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: showActionBar ? 110 : 32 }} />
        </View>
      </ScrollView>

      {showActionBar ? (
        <View style={styles.actionBar}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.actionBarTint} />
          {nextStatus ? (
            <TouchableOpacity
              style={[styles.primaryAction, updating && styles.actionDisabled]}
              onPress={advance}
              disabled={updating}
              accessibilityRole="button"
              accessibilityLabel={`Mark as ${formatOrderStatusLabel(nextStatus)}`}
            >
              <View>
                <Text style={styles.primaryActionKicker}>ADMIN OVERRIDE</Text>
                <Text style={styles.primaryActionText}>
                  {updating ? "Updating…" : `Mark as ${formatOrderStatusLabel(nextStatus)}`}
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
              onPress={() => setReasonModal("refunded")}
              disabled={updating}
              accessibilityRole="button"
              accessibilityLabel="Refund order"
            >
              <Ionicons name="return-down-back-outline" size={17} color={C.rust} />
              <Text style={styles.refundActionText}>{updating ? "Updating…" : "Refund order"}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={closeReason}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{reasonModal === "refunded" ? "Refund order" : "Cancel order"}</Text>
            <Text style={styles.modalBody}>
              {reasonModal === "refunded"
                ? "This marks the order as refunded and notifies the buyer."
                : `Cancel ${order.order_number}? Stock is restored and the buyer is notified.`}{" "}
              Add an optional reason for the audit log:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder={reasonModal === "refunded" ? "e.g. Customer reported defect" : "e.g. Seller out of stock"}
              placeholderTextColor={C.muted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closeReason}>
                <Text style={styles.modalBtnCancelText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={submitReason}>
                <Text style={styles.modalBtnConfirmText}>{reasonModal === "refunded" ? "Refund" : "Cancel order"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MenuSheet open={menuOpen} items={menu} onClose={() => setMenuOpen(false)} bottom={0} />
    </View>
  );
}

function Header({ onMore }: { onBack?: () => void; onMore?: () => void }) {
  // AdminTopBar already renders the back button for admin sub-routes.
  return (
    <View style={styles.topBar}>
      <View>
        <Text style={styles.topKicker}>ADMIN · ORDERS</Text>
        <Text style={styles.topTitle} accessibilityRole="header">Order Details</Text>
      </View>
      {onMore ? (
        <TouchableOpacity style={styles.circleBtn} onPress={onMore} activeOpacity={0.8} accessibilityLabel="More actions">
          <Ionicons name="ellipsis-vertical" size={18} color={C.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LedgerLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.ledgerLine}>
      <Text style={styles.ledgerLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.ledgerValue, accent && { color: C.accent }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function CopyLine({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <TouchableOpacity style={styles.ledgerLine} onPress={onCopy} activeOpacity={0.7} accessibilityLabel={`Copy ${label}`}>
      <Text style={styles.ledgerLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.copyValue}>
        <Text style={styles.monoValue}>{shortId(value)}</Text>
        <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={13} color={copied ? C.accent : C.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  topKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.6, color: C.accent },
  topTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: C.text, letterSpacing: -0.4, marginTop: 2 },

  loadingContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  loadingTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted, textAlign: "center" },
  retryBtn: { marginTop: 4, height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: C.ink, justifyContent: "center" },
  retryBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.cream },

  scroll: { flexGrow: 1, paddingTop: 6 },

  itemsHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 22, marginBottom: 10 },
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
  itemThumb: { width: 64, height: 64, borderRadius: 16, overflow: "hidden", backgroundColor: "#f0ede2", alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1, minWidth: 0, gap: 2 },
  itemSku: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.2, color: C.accent },
  itemName: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  itemPrice: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text, fontVariant: ["tabular-nums"] },
  variantChip: { paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: C.accentSoft, maxWidth: 140 },
  variantChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
  unitText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  cancelPiece: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.rust },
  strike: { textDecorationLine: "line-through", opacity: 0.6 },
  noItems: { paddingVertical: 16, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },

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
  roundDark: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  storeRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  storeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { fontFamily: fontFamilies.sans.bold, fontSize: 15.5, letterSpacing: -0.2, color: C.text, marginTop: 1 },

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
  book: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 20, backgroundColor: "#FFFFFF" },
  bookTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  bookPill: { height: 30, paddingHorizontal: 14, borderRadius: 15, justifyContent: "center" },
  bookPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5 },
  bookNumberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bookNumber: { flexShrink: 1, fontFamily: fontFamilies.sans.bold, fontSize: 26, letterSpacing: -0.6, color: C.text },

  receivedBanner: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(46, 125, 50, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(46, 125, 50, 0.24)",
    borderRadius: 20,
    padding: 14,
  },
  receivedBannerTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#2e7d32" },
  receivedBannerBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "#388e3c", marginTop: 3, lineHeight: 17 },

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

  block: { marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: "#faf9f4", borderWidth: 1, borderColor: C.line },
  blockWarn: { backgroundColor: "rgba(184,92,58,0.05)", borderColor: "rgba(184,92,58,0.2)" },
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
  ledgerRule: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  ledgerLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  ledgerLabel: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  ledgerValue: {
    flexShrink: 1,
    maxWidth: "62%",
    textAlign: "right",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: C.text,
    fontVariant: ["tabular-nums"],
    textTransform: "none",
  },
  copyValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  monoValue: { fontFamily: fontFamilies.mono.medium, fontSize: 12, color: C.text },
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
  ledgerTotalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text, fontVariant: ["tabular-nums"] },
  evidence: { marginTop: 14, width: "100%", height: 160, borderRadius: 16, backgroundColor: "#f0ede2" },

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
  senderKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.2, color: C.accent, marginBottom: 2 },
  contactWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, paddingLeft: 54 },
  phoneChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },

  cancelRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48 },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.rust },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  actionBarTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.72)" },
  primaryAction: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 30,
    backgroundColor: C.ink,
    paddingLeft: 24,
    paddingRight: 7,
    shadowColor: "#16150F",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  primaryActionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.6, color: C.lime, marginBottom: 2 },
  primaryActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: C.cream },
  primaryActionArrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" },
  refundAction: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.3)",
    backgroundColor: "rgba(184,92,58,0.05)",
  },
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
