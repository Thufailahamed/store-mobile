import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  ActivityIndicator,
  Dimensions,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { getOrderById } from "@/lib/api";
import { mapProducts } from "@/lib/api/product-mapper";
import { trackEvent, snapshotProduct } from "@/lib/recommender";
import { Button, Avatar, useToast } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderItem, Product, OrderStatus } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

  // Fetch Referral Code
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadReferral = async () => {
      try {
        const { data: refData } = await supabase
          .from("referral_codes")
          .select("code")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (refData?.code) {
          setReferralCode(refData.code);
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("referral_code")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (userData?.referral_code) {
          setReferralCode(userData.referral_code);
          return;
        }

        const fallback = `LUXE${user.id.slice(0, 6).toUpperCase()}`;
        setReferralCode(fallback);
      } catch {
        if (!cancelled) {
          const fallback = `LUXE${user.id.slice(0, 6).toUpperCase()}`;
          setReferralCode(fallback);
        }
      }
    };
    loadReferral();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

      const categoryIds = orderItems
        .map((item) => item.product?.category_id)
        .filter(Boolean) as string[];

      let query = supabase
        .from("products")
        .select(
          "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*)"
        )
        .eq("status", "active")
        .limit(6);

      if (categoryIds.length > 0) {
        query = query.in("category_id", categoryIds);
      }

      const { data } = await query;
      const orderProductIds = orderItems.map((item) => item.product_id);

      let filtered = mapProducts((data as Product[]) || []).filter(
        (p) => !orderProductIds.includes(p.id)
      );

      if (filtered.length === 0) {
        const { data: featured } = await supabase
          .from("products")
          .select(
            "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*)"
          )
          .eq("status", "active")
          .eq("is_featured", true)
          .limit(6);
        filtered = mapProducts((featured as Product[]) || []).filter(
          (p) => !orderProductIds.includes(p.id)
        );
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
        message: `Use my invite code ${referralCode} to get Rs. 1,500 off your first purchase at LUXE Boutique!`,
      });
    } catch {
      // ignore
    }
  };

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

  // Map database status to 4 timeline steps
  const getTimelineStatus = (status: OrderStatus) => {
    return {
      placed: true,
      confirmed: ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"].includes(status),
      shipped: ["shipped", "out_for_delivery", "delivered"].includes(status),
      delivered: status === "delivered",
    };
  };

  const timeline = getTimelineStatus(order.status);
  const formattedDate = new Date(order.placed_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <PaperBackground style={styles.container}>
      {/* Header bar */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(12, insets.top),
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.replace("/(main)")}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Display
          size="lg"
          italic
          style={{
            color: theme.colors.foreground,
            fontFamily: fontFamilies.display.semibold,
            letterSpacing: 0.5,
          }}
        >
          LUXE
        </Display>
        <TouchableOpacity
          onPress={handleHelpPress}
          style={[styles.helpBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <Label style={{ color: theme.colors.foreground, fontSize: 11 }}>Help</Label>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Banner */}
        <View style={styles.heroSection}>
          <View style={[styles.checkCircle, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="checkmark" size={32} color={theme.colors.primaryForeground} />
          </View>
          <Display size="xl" style={[styles.heroTitle, { color: theme.colors.foreground }]}>
            {siblingOrderIds.length > 0
              ? `Your ${allOrderIds.length} orders are confirmed`
              : "Your order is confirmed"}
          </Display>
          <Body muted size="sm" style={styles.heroSubtitle}>
            Order #{order.order_number} · Placed {formattedDate}
          </Body>
          {siblingOrderIds.length > 0 && (
            <Body muted size="sm" style={styles.heroSubtitle}>
              {siblingOrderIds.length} other order{siblingOrderIds.length === 1 ? "" : "s"} from other store
              {siblingOrderIds.length === 1 ? "" : "s"} created — see below.
            </Body>
          )}
        </View>

        {/* Sibling orders from other stores (multi-vendor) */}
        {siblingOrders.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <Display size="lg" style={[styles.cardTitle, { color: theme.colors.foreground }]}>
                Other orders in this purchase
              </Display>
            </View>
            {siblingOrders.map((sibling) => (
              <TouchableOpacity
                key={sibling.id}
                style={[styles.siblingRow, { borderTopColor: theme.colors.border }]}
                onPress={() =>
                  router.push(`/(main)/account/orders/${sibling.id}` as never)
                }
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Label style={{ color: theme.colors.foreground }}>
                    Order #{sibling.order_number}
                  </Label>
                  <Body size="xs" muted>
                    Status: {sibling.status}
                  </Body>
                </View>
                <Body size="sm" style={{ color: theme.colors.foreground, fontWeight: "600" }}>
                  {formatPrice(sibling.total, sibling.currency)}
                </Body>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timeline */}
        <View
          style={[
            styles.timelineCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.timelineRow}>
            {/* Connecting lines */}
            <View
              style={[
                styles.timelineLine,
                {
                  left: "12.5%",
                  right: "62.5%",
                  backgroundColor: timeline.confirmed ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
            <View
              style={[
                styles.timelineLine,
                {
                  left: "37.5%",
                  right: "37.5%",
                  backgroundColor: timeline.shipped ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
            <View
              style={[
                styles.timelineLine,
                {
                  left: "62.5%",
                  right: "12.5%",
                  backgroundColor: timeline.delivered ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />

            {/* Placed */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Ionicons name="checkmark" size={16} color={theme.colors.primaryForeground} />
              </View>
              <Label style={[styles.timelineLabel, { color: theme.colors.foreground }]}>Placed</Label>
            </View>

            {/* Confirmed */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: timeline.confirmed ? theme.colors.primary : theme.colors.card,
                    borderColor: timeline.confirmed ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                {timeline.confirmed ? (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primaryForeground} />
                ) : (
                  <Ionicons name="cart-outline" size={16} color={theme.colors.mutedForeground} />
                )}
              </View>
              <Label
                style={[
                  styles.timelineLabel,
                  { color: timeline.confirmed ? theme.colors.foreground : theme.colors.mutedForeground },
                ]}
              >
                Confirmed
              </Label>
            </View>

            {/* Shipped */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: timeline.shipped ? theme.colors.primary : theme.colors.card,
                    borderColor: timeline.shipped ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                {timeline.shipped ? (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primaryForeground} />
                ) : (
                  <Ionicons name="car-outline" size={16} color={theme.colors.mutedForeground} />
                )}
              </View>
              <Label
                style={[
                  styles.timelineLabel,
                  { color: timeline.shipped ? theme.colors.foreground : theme.colors.mutedForeground },
                ]}
              >
                Shipped
              </Label>
            </View>

            {/* Delivered */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: timeline.delivered ? theme.colors.primary : theme.colors.card,
                    borderColor: timeline.delivered ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                {timeline.delivered ? (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primaryForeground} />
                ) : (
                  <Ionicons name="home-outline" size={16} color={theme.colors.mutedForeground} />
                )}
              </View>
              <Label
                style={[
                  styles.timelineLabel,
                  { color: timeline.delivered ? theme.colors.foreground : theme.colors.mutedForeground },
                ]}
              >
                Delivered
              </Label>
            </View>
          </View>
        </View>

        {/* Delivery Details Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <Display size="lg" style={[styles.cardTitle, { color: theme.colors.foreground }]}>
              Delivery details
            </Display>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
          </View>

          <View style={styles.detailSection}>
            {/* Address Row */}
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.olive[50] }]}>
                <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Label style={[styles.detailLabel, { color: theme.colors.mutedForeground }]}>
                  Address
                </Label>
                <Body size="sm" style={{ color: theme.colors.foreground, fontWeight: "600" }}>
                  {order.address?.full_name || order.shipping_address?.full_name}
                </Body>
                <Body size="xs" muted style={{ marginTop: 2 }}>
                  {[
                    order.address?.line1 || order.shipping_address?.line1,
                    order.address?.line2 || order.shipping_address?.line2,
                    order.address?.city || order.shipping_address?.city,
                    order.address?.state || order.shipping_address?.state,
                    order.address?.postal_code || order.shipping_address?.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Body>
              </View>
            </View>

            {/* Note/Instructions Row */}
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.olive[50] }]}>
                <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Label style={[styles.detailLabel, { color: theme.colors.mutedForeground }]}>
                  Instructions
                </Label>
                <Body size="xs" muted>
                  {order.notes || "Leave at my door if I am not around. Please don't ring the doorbell, just leave it at the door, thank you!"}
                </Body>
              </View>
            </View>

            {/* Contact Row */}
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.olive[50] }]}>
                <Ionicons name="call-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Label style={[styles.detailLabel, { color: theme.colors.mutedForeground }]}>
                  Contact
                </Label>
                <Body size="xs" muted>
                  {order.address?.phone || order.shipping_address?.phone || "No phone number provided"}
                </Body>
              </View>
            </View>

            {/* Gift tag display */}
            <View style={[styles.giftBadge, { backgroundColor: theme.colors.accent + "15" }]}>
              <Ionicons name="gift-outline" size={20} color={theme.colors.ring} />
              <View style={{ flex: 1 }}>
                <Body size="xs" style={{ fontWeight: "600", color: theme.colors.foreground }}>
                  Gift for {order.address?.full_name?.split(" ")[0] || "You"}
                </Body>
                <Body size="xs" muted style={{ fontStyle: "italic", marginTop: 1 }}>
                  Enjoy!
                </Body>
              </View>
            </View>
          </View>
        </View>

        {/* Invite Friends & Earn Money Card */}
        {referralCode ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
                <Display size="lg" style={[styles.cardTitle, { color: theme.colors.foreground }]}>
                  Invite friends, earn money!
                </Display>
              </View>
            </View>

            <View style={[styles.invitePill, { backgroundColor: theme.olive[100] }]}>
              <Label style={{ color: theme.olive[800], fontSize: 11, fontWeight: "700" }}>
                Rs. 1,500 for you, Rs. 1,500 for a friend
              </Label>
            </View>

            <Body size="xs" muted style={{ marginVertical: 6 }}>
              Share your invite code with friends. They get Rs. 1,500 off their first purchase, and you receive Rs. 1,500 points in your account!
            </Body>

            <View style={[styles.inviteRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <Body style={[styles.codeText, { color: theme.colors.foreground }]}>
                {referralCode}
              </Body>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: theme.colors.secondary }]}
                  onPress={handleCopyReferral}
                  activeOpacity={0.7}
                >
                  <Label style={{ color: theme.colors.secondaryForeground, fontSize: 11 }}>Copy</Label>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleShareReferral}
                  activeOpacity={0.7}
                >
                  <Label style={{ color: theme.colors.primaryForeground, fontSize: 11 }}>Invite</Label>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* Collapsible Receipt Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setReceiptExpanded(!receiptExpanded)}
            activeOpacity={0.7}
          >
            <Display size="lg" style={[styles.cardTitle, { color: theme.colors.foreground }]}>
              Receipt
            </Display>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Body muted size="xs">
                {receiptExpanded ? "Collapse" : `Paid ${formatPrice(order.total, order.currency)}`}
              </Body>
              <Ionicons
                name={receiptExpanded ? "chevron-up" : "chevron-forward"}
                size={16}
                color={theme.colors.mutedForeground}
              />
            </View>
          </TouchableOpacity>

          <Body size="xs" muted>
            Paid with {order.payment_method === "cod" ? "Cash on Delivery" : "Card via PayHere"}
          </Body>

          {receiptExpanded && (
            <View style={[styles.receiptSummary, { borderTopColor: theme.colors.border }]}>
              {/* Receipt Breakdowns */}
              <View style={styles.summaryRow}>
                <Body muted size="sm">
                  Subtotal
                </Body>
                <Body size="sm" style={{ color: theme.colors.foreground }}>
                  {formatPrice(order.subtotal, order.currency)}
                </Body>
              </View>

              {order.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Body muted size="sm">
                    Discount
                  </Body>
                  <Body size="sm" style={{ color: theme.olive[600] }}>
                    -{formatPrice(order.discount, order.currency)}
                  </Body>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Body muted size="sm">
                  Shipping
                </Body>
                <Body size="sm" style={{ color: order.shipping_fee === 0 ? theme.olive[600] : theme.colors.foreground }}>
                  {order.shipping_fee === 0 ? "FREE" : formatPrice(order.shipping_fee, order.currency)}
                </Body>
              </View>

              <View style={styles.summaryRow}>
                <Body muted size="sm">
                  Tax
                </Body>
                <Body size="sm" style={{ color: theme.colors.foreground }}>
                  {formatPrice(order.tax, order.currency)}
                </Body>
              </View>

              <View
                style={[
                  styles.summaryRow,
                  {
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                    marginTop: 6,
                    paddingTop: 8,
                  },
                ]}
              >
                <Label style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "700" }}>
                  Total Paid
                </Label>
                <Price style={{ color: theme.colors.primary }} size="base">
                  {formatPrice(order.total, order.currency)}
                </Price>
              </View>

              {/* Items List inside Receipt */}
              <View style={[styles.receiptItemsList, { borderTopColor: theme.colors.border }]}>
                <Label style={{ color: theme.colors.foreground, fontSize: 11, marginBottom: 4 }}>
                  Items in this order
                </Label>
                {order.items?.map((item) => {
                  const img =
                    item.product?.images?.find((i) => i.is_primary)?.url ||
                    item.product?.images?.[0]?.url;
                  return (
                    <View key={item.id} style={styles.receiptItemRow}>
                      <Avatar uri={img} size={44} style={{ borderRadius: theme.radii.md }} />
                      <View style={styles.receiptItemInfo}>
                        <Body size="sm" style={{ color: theme.colors.foreground, fontWeight: "500" }} numberOfLines={1}>
                          {item.product_name}
                        </Body>
                        {item.variant_label && (
                          <Body size="xs" muted>
                            {item.variant_label}
                          </Body>
                        )}
                        <Body size="xs" muted>
                          Qty {item.quantity} · {formatPrice(item.unit_price, order.currency)}
                        </Body>
                      </View>
                      <View style={styles.receiptItemPrice}>
                        <Price size="sm" style={{ color: theme.colors.foreground }}>
                          {formatPrice(item.total, order.currency)}
                        </Price>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Pairs Well With Your Order (Recommendations) */}
        {!loadingRecs && recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Display
              size="lg"
              style={[styles.recommendationsTitle, { color: theme.colors.foreground }]}
            >
              Pairs well with your order
            </Display>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {recommendations.map((p) => (
                <ProductCard key={p.id} product={p} horizontal />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Primary Action Buttons */}
        <View style={styles.actionsSection}>
          <Button variant="brand" onPress={() => router.replace("/(main)")} style={{ height: 48 }}>
            Continue Shopping
          </Button>
          <Button
            variant="outline"
            onPress={() => router.replace("/(main)/account/orders")}
            style={{ height: 48 }}
          >
            View Order History
          </Button>
        </View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  helpBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTitle: {
    textAlign: "center",
    fontWeight: "700",
  },
  heroSubtitle: {
    textAlign: "center",
  },
  timelineCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  timelineStep: {
    alignItems: "center",
    flex: 1,
    zIndex: 2,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  timelineLabel: {
    fontSize: 9,
    marginTop: 8,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  timelineLine: {
    position: "absolute",
    top: 24,
    height: 1.5,
    zIndex: 1,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontWeight: "600",
  },
  detailSection: {
    gap: 12,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  giftBadge: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  invitePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginVertical: 4,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  codeText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  receiptSummary: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  receiptItemsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  receiptItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  receiptItemInfo: {
    flex: 1,
    gap: 2,
  },
  receiptItemPrice: {
    alignItems: "flex-end",
  },
  recommendationsSection: {
    marginTop: 8,
    gap: 12,
  },
  recommendationsTitle: {
    fontWeight: "600",
  },
  actionsSection: {
    gap: 12,
    marginTop: 12,
    paddingBottom: 40,
  },
  siblingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
