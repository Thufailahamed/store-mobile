import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  ActivityIndicator,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { useAuth } from "@/lib/supabase/auth";
import { getOrderById } from "@/lib/api";
import { getProductsBackend, getReferralStatsBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import { trackEvent, snapshotProduct } from "@/lib/recommender";
import { Button, Avatar, useToast } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderItem, Product, OrderStatus } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";

export default function OrderSuccessScreen() {
  const { orderId, orderIds } = useLocalSearchParams<{ orderId?: string; orderIds?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  // Multi-vendor: prefer orderIds, fall back to orderId for legacy single-order checkouts.
  const allOrderIds = (orderIds?.split(",").filter(Boolean).length
    ? orderIds!.split(",").filter(Boolean)
    : orderId
      ? [orderId]
      : []) as string[];
  const firstOrderId = allOrderIds[0] ?? null;
  const siblingOrderIds = allOrderIds.slice(1);
  const [siblingOrders, setSiblingOrders] = useState<Array<Pick<Order, "id" | "order_number" | "status" | "total" | "currency">>>([]);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string>("");
  const [receiptExpanded, setReceiptExpanded] = useState(false);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Fetch Order Details
  useEffect(() => {
    if (!firstOrderId) {
      setLoading(false);
      return;
    }
    // Tabs keep this screen mounted between orders — drop the previous order
    // so a second checkout never flashes stale details.
    setOrder(null);
    setRecommendations([]);
    setReceiptExpanded(false);
    setLoading(true);
    let cancelled = false;

    const loadOrder = async (attempt = 0) => {
      const res = await getOrderById(firstOrderId);
      if (cancelled) return;
      if (res.ok && res.data) {
        setOrder(res.data);
        fetchRecommendations(res.data.items || []);
        setLoading(false);
        return;
      }
      if (attempt < 3) {
        setTimeout(() => loadOrder(attempt + 1), 600);
        return;
      }
      setLoading(false);
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [firstOrderId]);

  // Fetch sibling order summaries (multi-vendor)
  useEffect(() => {
    if (siblingOrderIds.length === 0) {
      setSiblingOrders([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      siblingOrderIds.map((id) => getOrderById(id).then((res) => (res.ok ? res.data : null))),
    ).then((results) => {
      if (cancelled) return;
      const ok = results.filter(Boolean) as Order[];
      setSiblingOrders(
        ok.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          total: o.total,
          currency: o.currency,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [siblingOrderIds.join(",")]);

  // Fetch Referral Code — backend owns the source of truth (no fabricated
  // "LUXE${id.slice}" strings that collide in analytics / share intent).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadReferral = async () => {
      const res = await getReferralStatsBackend();
      if (cancelled) return;
      if (res.ok && res.data) {
        setReferralCode(res.data.code);
      }
    };
    void loadReferral();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fetch Recommendations dynamically
  const fetchRecommendations = async (orderItems: OrderItem[]) => {
    setLoadingRecs(true);
    try {
      // Track purchase events for the recommender.
      for (const item of orderItems) {
        if (item.product) {
          trackEvent(user?.id ?? null, {
            type: "purchase",
            t: Date.now(),
            product: snapshotProduct(item.product),
            quantity: item.quantity,
          });
        }
      }

      const categoryIds = Array.from(
        new Set(
          orderItems
            .map((item) => item.product?.category_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      // Try the first matching category first, then fall back to featured
      // picks. Backend already filters to status='active' + is_active=true
      // and returns the same shape that mapProducts consumes.
      let filtered: Product[] = [];
      for (const categoryId of categoryIds) {
        const res = await getProductsBackend({ category: categoryId, limit: 12 });
        if (res.ok && res.data) {
          filtered = mapProducts(res.data.products).slice(0, 6);
          if (filtered.length > 0) break;
        }
      }

      const orderProductIds = orderItems.map((item) => item.product_id);
      filtered = filtered.filter((p) => !orderProductIds.includes(p.id));

      if (filtered.length === 0) {
        // Featured fallback — sort by popularity to surface what other
        // buyers love.
        const res = await getProductsBackend({ sort: "popularity", limit: 12 });
        if (res.ok && res.data) {
          filtered = mapProducts(res.data.products)
            .filter((p) => !orderProductIds.includes(p.id))
            .slice(0, 6);
        }
      }
      setRecommendations(filtered);
    } catch {
      // ignore
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleHelpPress = () => {
    toast("Support is available 24/7 at support@luxe.com or +1 800 555 1234", "success");
  };

  const handleCopyReferral = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    toast("Referral code copied to clipboard!", "success");
    // Auto-clear the clipboard 60s later so the code doesn't sit in
    // clipboard history / sync caches indefinitely.
    setTimeout(() => {
      try {
        Clipboard.setString("");
      } catch {}
    }, 60_000);
  };

  const handleShareReferral = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: `Shop LUXE with my invite ${referralCode} — https://synapstore.shop/r/${referralCode}\nI earn 100 loyalty points when you complete your first paid order!`,
        url: `https://synapstore.shop/r/${referralCode}`,
      });
    } catch {
      // ignore
    }
  };

  // Entrance choreography: badge springs in, halo pulses, content rises.
  const checkScale = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!order) return;
    checkScale.setValue(0);
    contentAnim.setValue(0);
    haloAnim.setValue(0);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, damping: 10, stiffness: 170, useNativeDriver: true }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const pulse = Animated.loop(
      Animated.timing(haloAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    pulse.start();
    return () => pulse.stop();
  }, [order?.id, checkScale, contentAnim, haloAnim]);

  if (loading) {
    return (
      <PaperBackground style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Body muted style={{ marginTop: 12 }}>
            Loading order details...
          </Body>
        </View>
      </PaperBackground>
    );
  }

  if (!order) {
    return (
      <PaperBackground style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.destructive} />
          <Display size="lg" style={{ marginTop: 12, color: theme.colors.foreground }}>
            Order Not Found
          </Display>
          <Body muted style={{ marginTop: 6, marginBottom: 20 }}>
            We couldn't retrieve the details for this order.
          </Body>
          <Button variant="brand" onPress={() => router.replace("/(main)/account/orders")}>
            View orders
          </Button>
          <Button variant="outline" onPress={() => router.replace("/(main)")} style={{ marginTop: 12 }}>
            Return home
          </Button>
        </View>
      </PaperBackground>
    );
  }

  const firstName =
    (order.address?.full_name || order.shipping_address?.full_name || "").trim().split(/\s+/)[0] || "";
  const placedDate = new Date(order.placed_at);
  const formattedDate = placedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formattedTime = placedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const items = order.items ?? [];
  const itemCount = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const addr = order.address ?? order.shipping_address;
  const deliveryDate = (order as Order & { delivery_date?: string | null }).delivery_date ?? null;
  const paymentLabel =
    order.payment_method === "cod"
      ? "Cash on delivery"
      : order.payment_method === "stripe"
        ? "Card · Stripe"
        : "Card · Payments.lk";
  const isCod = order.payment_method === "cod";
  const grandTotal = order.total + siblingOrders.reduce((s, o) => s + (o.total || 0), 0);

  const STEPS: { key: "placed" | "confirmed" | "shipped" | "delivered"; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
    { key: "placed", label: "Placed", icon: "receipt-outline" },
    { key: "confirmed", label: "Confirmed", icon: "checkmark-done-outline" },
    { key: "shipped", label: "Shipped", icon: "cube-outline" },
    { key: "delivered", label: "Delivered", icon: "home-outline" },
  ];
  const done = {
    placed: true,
    confirmed: ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"].includes(order.status),
    shipped: ["shipped", "out_for_delivery", "delivered"].includes(order.status),
    delivered: order.status === "delivered",
  };
  const currentIdx = STEPS.reduce((last, s, i) => (done[s.key] ? i : last), 0);
  const statusLine = done.shipped
    ? "Your order is on its way to you."
    : done.confirmed
      ? "The atelier is preparing and packing your pieces."
      : "The atelier is reviewing your order — we'll notify you once it's confirmed.";

  const copyOrderNumber = () => {
    Clipboard.setString(order.order_number);
    toast("Order number copied", "success");
  };

  const rise = (delay: number) => ({
    opacity: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [
      {
        translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [18 + delay, 0] }),
      },
    ],
  });

  return (
    <PaperBackground style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity
          onPress={() => router.replace("/(main)")}
          style={styles.roundBtn}
          activeOpacity={0.7}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={INK} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>LUXE</Text>
        <TouchableOpacity onPress={handleHelpPress} style={styles.helpPill} activeOpacity={0.7}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={INK} />
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.badgeStage}>
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity: haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [{ scale: haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                },
              ]}
            />
            <View style={styles.haloStatic} />
            {CONFETTI.map((c, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: c.color,
                    width: c.size,
                    height: c.size,
                    borderRadius: c.round ? c.size / 2 : 2,
                    left: 80 + c.x,
                    top: 80 + c.y,
                    opacity: contentAnim,
                    transform: [
                      { rotate: `${c.rot}deg` },
                      { scale: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                    ],
                  },
                ]}
              />
            ))}
            <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
              <Ionicons name="checkmark" size={42} color={CREAM} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.heroText, rise(0)]}>
            <Text style={styles.eyebrow}>
              {siblingOrderIds.length > 0 ? `${allOrderIds.length} orders confirmed` : "Order confirmed"}
            </Text>
            <Text style={styles.heroTitle}>
              Thank you{firstName ? "," : "."}
              {firstName ? <Text style={styles.heroTitleItalic}>{`\n${firstName}.`}</Text> : null}
            </Text>
            <Text style={styles.heroSub}>
              {isCod
                ? "Your order is in. Keep the amount ready — you'll pay when it arrives."
                : "Your payment went through and your order is in."}
            </Text>
            <TouchableOpacity onPress={copyOrderNumber} activeOpacity={0.75} style={styles.orderChip}>
              <Text style={styles.orderChipLabel}>Order</Text>
              <Text style={styles.orderChipValue}>#{order.order_number}</Text>
              <Ionicons name="copy-outline" size={13} color={colors.olive[700]} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Ticket */}
        <Animated.View style={[styles.ticket, rise(8)]}>
          <View style={styles.ticketTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketLabel}>{isCod ? "To pay on delivery" : "Total paid"}</Text>
              <Text style={styles.ticketTotal}>{formatPrice(grandTotal, order.currency)}</Text>
            </View>
            <View style={styles.ticketPill}>
              <Ionicons name={isCod ? "cash-outline" : "card-outline"} size={13} color={colors.accent2.ochre} />
              <Text style={styles.ticketPillText}>{paymentLabel}</Text>
            </View>
          </View>

          <View style={styles.perforation}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashLine}>
              {Array.from({ length: 28 }).map((_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.ticketGrid}>
            <View style={styles.ticketCell}>
              <Text style={styles.ticketCellLabel}>Placed</Text>
              <Text style={styles.ticketCellValue}>{formattedDate}</Text>
              <Text style={styles.ticketCellSub}>{formattedTime}</Text>
            </View>
            <View style={styles.ticketCell}>
              <Text style={styles.ticketCellLabel}>Pieces</Text>
              <Text style={styles.ticketCellValue}>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </Text>
              <Text style={styles.ticketCellSub}>
                {allOrderIds.length > 1 ? `${allOrderIds.length} stores` : "1 store"}
              </Text>
            </View>
            <View style={styles.ticketCell}>
              <Text style={styles.ticketCellLabel}>{deliveryDate ? "Delivery" : "Deliver to"}</Text>
              <Text style={styles.ticketCellValue} numberOfLines={1}>
                {deliveryDate
                  ? new Date(deliveryDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  : addr?.city || "—"}
              </Text>
              <Text style={styles.ticketCellSub} numberOfLines={1}>
                {deliveryDate ? addr?.city ?? "" : addr?.state ?? ""}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Progress */}
        <Animated.View style={[styles.card, rise(14)]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Order status</Text>
            <TouchableOpacity
              onPress={() => router.push(`/(main)/account/orders/${order.id}/track` as never)}
              hitSlop={8}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>Track</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.olive[700]} />
            </TouchableOpacity>
          </View>
          <View style={styles.stepsRow}>
            {STEPS.map((s, i) => {
              const isDone = done[s.key];
              const isCurrent = i === currentIdx;
              return (
                <View key={s.key} style={styles.step}>
                  {i < STEPS.length - 1 ? (
                    <View style={[styles.stepLine, done[STEPS[i + 1].key] && styles.stepLineDone]} />
                  ) : null}
                  <View
                    style={[
                      styles.stepDot,
                      isDone && styles.stepDotDone,
                      isCurrent && styles.stepDotCurrent,
                    ]}
                  >
                    <Ionicons
                      name={isDone && !isCurrent ? "checkmark" : s.icon}
                      size={isCurrent ? 18 : 15}
                      color={isDone ? CREAM : colors.light.mutedForeground}
                    />
                  </View>
                  <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>{s.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.statusNote}>
            <View style={styles.liveDot} />
            <Text style={styles.statusNoteText}>{statusLine}</Text>
          </View>
        </Animated.View>

        {/* Items + receipt */}
        <Animated.View style={[styles.card, rise(20)]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Your pieces</Text>
            <Text style={styles.cardMeta}>{itemCount} item{itemCount === 1 ? "" : "s"}</Text>
          </View>
          {items.map((item, idx) => {
            const img =
              item.image_url ||
              item.product?.images?.find((i) => i.is_primary)?.url ||
              item.product?.images?.[0]?.url;
            return (
              <View key={item.id} style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}>
                <View style={styles.itemThumb}>
                  {img ? (
                    <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="shirt-outline" size={20} color={colors.light.mutedForeground} />
                  )}
                  {item.quantity > 1 ? (
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>×{item.quantity}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.variant_label ? <Text style={styles.itemVariant}>{item.variant_label}</Text> : null}
                  <Text style={styles.itemUnit}>
                    {item.quantity} × {formatPrice(item.unit_price, order.currency)}
                  </Text>
                  {item.is_gift ? (
                    <View style={styles.giftTag}>
                      <Ionicons name="gift-outline" size={12} color={colors.accent2.rust} />
                      <Text style={styles.giftTagText} numberOfLines={1}>
                        {item.gift_message ? `Gift · “${item.gift_message}”` : "Gift wrapped"}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.itemTotal}>{formatPrice(item.total, order.currency)}</Text>
              </View>
            );
          })}

          <TouchableOpacity
            onPress={() => setReceiptExpanded(!receiptExpanded)}
            activeOpacity={0.75}
            style={styles.breakdownToggle}
          >
            <Text style={styles.breakdownToggleText}>
              {receiptExpanded ? "Hide price breakdown" : "View price breakdown"}
            </Text>
            <Ionicons name={receiptExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.olive[700]} />
          </TouchableOpacity>

          {receiptExpanded ? (
            <View style={styles.breakdown}>
              <SummaryRow label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
              {order.discount > 0 ? (
                <SummaryRow label="Discount" value={`−${formatPrice(order.discount, order.currency)}`} accent />
              ) : null}
              <SummaryRow
                label="Shipping"
                value={order.shipping_fee === 0 ? "Free" : formatPrice(order.shipping_fee, order.currency)}
                accent={order.shipping_fee === 0}
              />
              {order.tax > 0 ? <SummaryRow label="Platform fee" value={formatPrice(order.tax, order.currency)} /> : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{isCod ? "Due on delivery" : "Total paid"}</Text>
                <Text style={styles.totalValue}>{formatPrice(order.total, order.currency)}</Text>
              </View>
            </View>
          ) : null}
        </Animated.View>

        {/* Other stores in this purchase */}
        {siblingOrders.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Also in this purchase</Text>
              <Text style={styles.cardMeta}>{siblingOrders.length} more</Text>
            </View>
            {siblingOrders.map((sibling, idx) => (
              <TouchableOpacity
                key={sibling.id}
                style={[styles.siblingRow, idx > 0 && styles.itemRowBorder]}
                onPress={() => router.push(`/(main)/account/orders/${sibling.id}` as never)}
                activeOpacity={0.7}
              >
                <View style={styles.siblingIcon}>
                  <Ionicons name="storefront-outline" size={16} color={colors.olive[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.siblingNumber}>#{sibling.order_number}</Text>
                  <Text style={styles.siblingStatus}>{sibling.status.replace(/_/g, " ")}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatPrice(sibling.total, sibling.currency)}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Delivery */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Delivery</Text>
          </View>
          <DetailRow icon="location-outline" label="Address">
            <Text style={styles.detailStrong}>{addr?.full_name}</Text>
            <Text style={styles.detailText}>
              {[addr?.line1, addr?.line2, addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", ")}
            </Text>
          </DetailRow>
          {addr?.phone ? (
            <DetailRow icon="call-outline" label="Contact">
              <Text style={styles.detailText}>{addr.phone}</Text>
            </DetailRow>
          ) : null}
          {order.notes ? (
            <DetailRow icon="document-text-outline" label="Instructions">
              <Text style={styles.detailText}>{order.notes}</Text>
            </DetailRow>
          ) : null}
        </View>

        {/* Referral */}
        {referralCode ? (
          <View style={styles.referral}>
            <View style={styles.referralHead}>
              <View style={styles.referralIcon}>
                <Ionicons name="sparkles" size={16} color={colors.accent2.ochre} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Share LUXE, earn 100 points</Text>
                <Text style={styles.referralSub}>
                  For every friend who completes their first paid order.
                </Text>
              </View>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode}</Text>
              <TouchableOpacity onPress={handleCopyReferral} style={styles.codeBtn} activeOpacity={0.75}>
                <Ionicons name="copy-outline" size={15} color={INK} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareReferral} style={[styles.codeBtn, styles.codeBtnPrimary]} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={15} color={CREAM} />
                <Text style={styles.codeBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Recommendations */}
        {!loadingRecs && recommendations.length > 0 ? (
          <View style={styles.recs}>
            <Text style={styles.recsEyebrow}>Complete the look</Text>
            <Text style={styles.recsTitle}>Pairs well with your order</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {recommendations.map((p) => (
                <ProductCard key={p.id} product={p} horizontal />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky actions */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          onPress={() => router.replace("/(main)")}
          style={styles.secondaryBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Keep shopping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/(main)/account/orders/${order.id}` as never)}
          style={styles.primaryBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>View order</Text>
          <Ionicons name="arrow-forward" size={16} color={CREAM} />
        </TouchableOpacity>
      </View>
    </PaperBackground>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && { color: colors.olive[600] }]}>{value}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={colors.olive[700]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const INK = colors.olive[900];
const CREAM = colors.paper.cream;
const SURFACE = "#ffffff";

/** Decorative confetti around the check badge (offsets from badge centre). */
const CONFETTI = [
  { x: -70, y: -40, size: 8, color: colors.accent2.ochre, rot: 20, round: false },
  { x: 62, y: -52, size: 6, color: colors.accent2.rust, rot: 0, round: true },
  { x: 74, y: 18, size: 9, color: colors.olive[400], rot: 45, round: false },
  { x: -78, y: 30, size: 5, color: colors.olive[600], rot: 0, round: true },
  { x: -40, y: -70, size: 5, color: colors.olive[300], rot: 0, round: true },
  { x: 30, y: 66, size: 7, color: colors.accent2.ochre, rot: 30, round: false },
  { x: -56, y: 62, size: 6, color: colors.accent2.rust, rot: 60, round: false },
  { x: 44, y: -78, size: 4, color: colors.olive[500], rot: 0, round: true },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    letterSpacing: 3,
    color: INK,
  },
  helpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  helpText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },

  /* Hero */
  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },
  badgeStage: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.olive[400],
  },
  haloStatic: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.olive[100],
  },
  confetti: {
    position: "absolute",
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: CREAM,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  heroText: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginTop: 4,
  },
  heroTitle: {
    marginTop: 8,
    fontFamily: fontFamilies.display.regular,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
    color: colors.light.foreground,
    textAlign: "center",
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[700],
  },
  heroSub: {
    marginTop: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.light.mutedForeground,
    textAlign: "center",
    maxWidth: 320,
  },
  orderChip: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  orderChipLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  orderChipValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12.5,
    color: INK,
  },

  /* Ticket */
  ticket: {
    backgroundColor: INK,
    borderRadius: 24,
    overflow: "hidden",
    ...shadows.editorial,
  },
  ticketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 20,
    paddingBottom: 16,
  },
  ticketLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.6)",
  },
  ticketTotal: {
    marginTop: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.8,
    color: CREAM,
  },
  ticketPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.18)",
  },
  ticketPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: CREAM,
  },
  perforation: {
    height: 20,
    justifyContent: "center",
  },
  dashLine: {
    marginHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  dash: {
    width: 6,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(250,248,241,0.25)",
  },
  notch: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.paper.DEFAULT,
  },
  notchLeft: { left: -10 },
  notchRight: { right: -10 },
  ticketGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  ticketCell: {
    flex: 1,
    gap: 3,
  },
  ticketCellLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.55)",
  },
  ticketCellValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: CREAM,
  },
  ticketCellSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: "rgba(250,248,241,0.6)",
  },

  /* Cards */
  card: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.light.border}aa`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 21,
    letterSpacing: -0.4,
    color: colors.light.foreground,
  },
  cardMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  linkText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[700],
  },

  /* Steps */
  stepsRow: {
    flexDirection: "row",
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  stepLine: {
    position: "absolute",
    top: 19,
    left: "50%",
    width: "100%",
    height: 2,
    backgroundColor: colors.light.muted,
  },
  stepLineDone: {
    backgroundColor: INK,
  },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    backgroundColor: INK,
    borderColor: INK,
  },
  stepDotCurrent: {
    borderWidth: 3,
    borderColor: colors.olive[200],
  },
  stepLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  stepLabelDone: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },
  statusNote: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent2.ochre,
  },
  statusNoteText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.olive[800],
  },

  /* Items */
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  itemThumb: {
    width: 64,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#efede4",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: INK,
  },
  qtyBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: CREAM,
  },
  itemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.light.foreground,
  },
  itemVariant: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  itemUnit: {
    marginTop: 4,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  itemTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  giftTag: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: `${colors.accent2.rust}12`,
    maxWidth: "100%",
  },
  giftTagText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.accent2.rust,
    flexShrink: 1,
  },
  breakdownToggle: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.paper.DEFAULT,
  },
  breakdownToggleText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[700],
  },
  breakdown: {
    marginTop: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },
  summaryValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.light.foreground,
  },
  totalValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: INK,
  },

  /* Siblings */
  siblingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  siblingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  siblingNumber: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  siblingStatus: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
  },

  /* Delivery */
  detailRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  detailStrong: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  detailText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
  },

  /* Referral */
  referral: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#f6efdc",
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}55`,
  },
  referralHead: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  referralIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  referralTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  referralSub: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.ink.mute,
  },
  codeBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 6,
    paddingLeft: 16,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: `${colors.accent2.ochre}aa`,
  },
  codeText: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    letterSpacing: 2,
    color: INK,
  },
  codeBtn: {
    height: 38,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.paper.DEFAULT,
  },
  codeBtnPrimary: {
    backgroundColor: INK,
    paddingHorizontal: 14,
  },
  codeBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: CREAM,
  },

  /* Recs */
  recs: {
    marginHorizontal: -16,
    paddingTop: 8,
  },
  recsEyebrow: {
    paddingHorizontal: 20,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  recsTitle: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 14,
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.light.foreground,
  },

  /* Action bar */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(250,248,241,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  secondaryBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: INK,
  },
  primaryBtn: {
    flex: 1.3,
    height: 54,
    borderRadius: 27,
    backgroundColor: INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.glow,
    shadowColor: INK,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: CREAM,
  },
});
