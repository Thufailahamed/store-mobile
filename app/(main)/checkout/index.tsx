import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader, SectionHeader } from "@/components/layout";
import { PayHereCheckout } from "@/components/payments/PayHereCheckout";
import {
  AddressFormSheet,
  type AddressFormPayload,
} from "@/components/address/AddressFormSheet";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/utils";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useLoyalty } from "@/lib/hooks/useLoyalty";
import { getPayHereSession, pollOrderPaymentStatus } from "@/lib/api/payments";
import { placeOrderGroupBackend, abandonOrderGroupBackend } from "@/lib/api/backend";
import { Button } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { useToast } from "@/components/ui";
import * as api from "@/lib/api";
import { validateCartForCheckout, refreshCartFromCatalog, fetchCartProductSnapshots } from "@/lib/cart-validation";
import { validateCheckoutAddress, checkoutAddressFieldLabel, checkoutAddressInvalidLabel } from "@/lib/checkout-validation";
import {
  clearCheckoutSession,
  isCheckoutPrepared,
  restoreUnselectedCartItems,
} from "@/lib/cart-checkout-session";
import {
  abandonUnpaidPayHereOrder,
  cancelPlacedOrder,
  cartItemsToReservations,
  flushCartReservationSync,
  releaseCartReservations,
} from "@/lib/inventory-reservations";
import {
  formatPrice,
  SHIPPING_OPTIONS,
  type ShippingKey,
} from "@/lib/utils";
import { computeCartTotals } from "@/lib/cart-pricing";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";

const STEPS = [
  { key: 1, label: "Address" },
  { key: 2, label: "Shipping" },
  { key: 3, label: "Payment" },
  { key: 4, label: "Review" },
];

function parsePlacedOrder(data: unknown): { id: string; order_number?: string } | null {
  if (!data) return null;
  if (typeof data === "string") return { id: data };
  if (Array.isArray(data)) return parsePlacedOrder(data[0]);
  if (typeof data === "object") {
    const row = data as Record<string, unknown>;
    const id = row.id ?? row.order_id;
    if (typeof id === "string" && id.length > 0) {
      return {
        id,
        order_number: typeof row.order_number === "string" ? row.order_number : undefined,
      };
    }
  }
  return null;
}

/** Parse the place_order_group RPC response into a flat list of sub-orders. */
function parseGroupOrders(data: unknown): Array<{ id: string; order_number?: string; store_id?: string; total?: number }> | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { orders?: unknown; group_id?: string };
  const ordersRaw = Array.isArray(row.orders) ? row.orders : [];
  const out: Array<{ id: string; order_number?: string; store_id?: string; total?: number }> = [];
  for (const o of ordersRaw) {
    if (!o || typeof o !== "object") continue;
    const sub = o as Record<string, unknown>;
    const id = typeof sub.id === "string" ? sub.id : null;
    if (!id) continue;
    out.push({
      id,
      order_number: typeof sub.order_number === "string" ? sub.order_number : undefined,
      store_id: typeof sub.store_id === "string" ? sub.store_id : undefined,
      total: typeof sub.total === "number" ? sub.total : undefined,
    });
  }
  return out;
}

/** Round to 2dp without floating-point drift. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** RFC 4122 v4 UUID via WebCrypto when available, else fallback. */
function uuidv4(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as { randomUUID?: () => string }).randomUUID === "function") {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // fall through
  }
  // RFC4122 fallback using Math.random — fine for client-side group ids.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return (
    `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { openAddress } = useLocalSearchParams<{ openAddress?: string }>();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const loyalty = useLoyalty();
  const { items, subtotal, couponCode, setCoupon, clear, addItem } = useCart();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [payhereVisible, setPayhereVisible] = useState(false);
  const [payhereSession, setPayhereSession] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const pendingLoyaltyPointsRef = useRef(0);
  /** Order ids created during a multi-vendor place_order fan-out. The first
   *  id is the PayHere-anchored order; the rest are tracked alongside it. */
  const pendingOrderIdsRef = useRef<string[]>([]);
  /** The order id that PayHere is currently processing (subset of
   *  pendingOrderIdsRef). */
  const pendingOrderIdsFirstRef = useRef<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [couponInput, setCouponInput] = useState(couponCode || "");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [freeShippingCoupon, setFreeShippingCoupon] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState<string | null>(null);
  const [giftCardCredit, setGiftCardCredit] = useState(0);
  const [giftCardCurrency, setGiftCardCurrency] = useState("LKR");

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Sri Lanka");
  const [shippingKey, setShippingKey] = useState<ShippingKey>("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "payhere">("cod");
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

  const cartItems = Object.values(items);
  const pricingLines = useMemo(
    () =>
      cartItems.map((item) => ({
        storeId: item.storeId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    [cartItems],
  );
  const pointsToUse = usePoints
    ? Math.floor(
        Math.min(
          loyalty.state.points,
          Math.floor(Math.max(0, subtotal() - couponDiscount)),
        ) / 100,
      ) * 100
    : 0;
  const checkoutTotals = useMemo(
    () =>
      computeCartTotals({
        lines: pricingLines,
        shippingKey,
        couponDiscount,
        pointsValue: pointsToUse,
        freeShippingCoupon,
      }),
    [pricingLines, shippingKey, couponDiscount, pointsToUse, freeShippingCoupon],
  );
  const sub = checkoutTotals.sub;
  const shippingFee = checkoutTotals.shipping;
  const afterCoupon = checkoutTotals.afterCoupon;
  const pointsValue = pointsToUse;
  const tax = checkoutTotals.tax;
  const total = checkoutTotals.total;
  const earnEstimate = Math.floor(afterCoupon * 0.05);
  // Max redeemable points: capped at balance and post-coupon subtotal (100-pt blocks).
  const maxRedeemablePts =
    Math.floor(Math.min(loyalty.state.points, Math.floor(Math.max(0, sub - couponDiscount))) / 100) * 100;
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.key === shippingKey) ?? SHIPPING_OPTIONS[0];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      const prepared = await isCheckoutPrepared();
      if (cancelled) return;
      if (!prepared || Object.keys(items).length === 0) {
        toast("Select items in your bag before checkout", "info");
        router.replace("/(main)/cart");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, items, router, toast]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void refreshCartFromCatalog().then((result) => {
        if (!result.ok) {
          toast(result.error, "error");
        }
      });
    }, [user, toast]),
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    api.getAddresses(user.id).then((res) => {
      if (res.ok && res.data.length) {
        setSavedAddresses(res.data);
        const def = res.data.find((a) => a.is_default) || res.data[0];
        setSelectedAddressId(def.id);
        fillAddress(def);
      } else if (openAddress === "1") {
        setAddressSheetOpen(true);
      }
    });
  }, [user, authLoading, openAddress, router]);

  const fillAddress = (a: Address) => {
    setFullName(a.full_name);
    setPhone(a.phone);
    setLine1(a.line1);
    setLine2(a.line2 || "");
    setCity(a.city);
    setState(a.state);
    setPostalCode(a.postal_code);
    setCountry(a.country || "Sri Lanka");
  };

  const handleNewAddressSubmit = async (payload: AddressFormPayload) => {
    if (!user) return;
    const basePayload = {
      user_id: user.id,
      type: payload.type,
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      line1: payload.line1.trim(),
      line2: payload.line2.trim() || undefined,
      city: payload.city.trim(),
      state: payload.state.trim(),
      postal_code: payload.postal_code.trim(),
      country: payload.country.trim() || "Sri Lanka",
      latitude: payload.latitude,
      longitude: payload.longitude,
      is_default: false,
    };
    const res = await api.createAddress(basePayload as any);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    const saved = res.data;
    setSavedAddresses((prev) => [saved, ...prev]);
    setSelectedAddressId(saved.id);
    fillAddress(saved);
    setAddressSheetOpen(false);
    toast("Address added", "success");
  };

  const applyCoupon = async () => {
    if (!user) return;
    const trimmed = couponInput.trim();
    if (!trimmed) {
      toast("Enter a coupon code first", "error");
      return;
    }
    const res = await api.validateCoupon(trimmed, user.id, sub);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    if (res.data.message !== "OK" && res.data.message !== "OK_FREE_SHIPPING") {
      toast(res.data.message || "Coupon cannot be applied", "error");
      return;
    }
    setCoupon(trimmed.toUpperCase());
    setCouponId(res.data.couponId);
    setCouponDiscount(res.data.message === "OK_FREE_SHIPPING" ? 0 : res.data.discount);
    setFreeShippingCoupon(res.data.message === "OK_FREE_SHIPPING");
    toast("Coupon applied", "success");
  };

  // Re-validate the applied coupon whenever the cart subtotal changes. The
  // discount returned by `validateCoupon` is anchored to the subtotal at
  // apply-time, so a stock-driven cart edit (item removed, qty capped) can
  // leave the buyer with a discount that no longer satisfies
  // min_order_value, or a stale discount number.
  useEffect(() => {
    if (!user || !couponId || !couponCode) return;
    let cancelled = false;
    api.validateCoupon(couponCode, user.id, sub).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        clearCoupon();
        toast(`Coupon no longer valid: ${res.error}`, "error");
        return;
      }
      if (res.data.message === "OK_FREE_SHIPPING") {
        setCouponDiscount(0);
        setFreeShippingCoupon(true);
      } else if (res.data.message === "OK") {
        setCouponDiscount(res.data.discount);
        setFreeShippingCoupon(false);
      } else {
        // Coupon rule no longer satisfied (e.g. min_order_value).
        clearCoupon();
        toast(res.data.message || "Coupon no longer valid for this bag", "error");
      }
    });
    return () => {
      cancelled = true;
    };
    // `couponCode` is the user-facing key; `couponId` is the resolved DB id.
    // `sub` is the trigger — re-validate whenever the cart subtotal shifts.
  }, [user?.id, couponId, couponCode, sub]);

  const handlePlaceOrder = async () => {
    if (authLoading) return;
    if (!user) {
      toast("Please sign in to place your order", "error");
      router.replace("/(auth)/login");
      return;
    }
    if (cartItems.length === 0) {
      toast("Your bag is empty", "error");
      router.replace("/(main)/cart");
      return;
    }

    const addressCheck = validateCheckoutAddress({
      full_name: fullName,
      phone,
      line1,
      city,
      state,
      postal_code: postalCode,
    });
    if (!addressCheck.ok) {
      const firstIssue =
        addressCheck.invalid[0] != null
          ? checkoutAddressInvalidLabel(addressCheck.invalid[0])
          : `${checkoutAddressFieldLabel(addressCheck.missing[0])} required`;
      toast(`Please complete your delivery address (${firstIssue})`, "error");
      setStep(1);
      setAddressSheetOpen(true);
      return;
    }
    // Belt-and-braces: when a saved address is selected, also validate
    // the record on file — the local fields are only set when `fillAddress`
    // runs, so a stale `address` could otherwise bypass the guard.
    if (selectedAddressId !== "new") {
      const target = savedAddresses.find((a) => a.id === selectedAddressId);
      if (target) {
        const savedCheck = validateCheckoutAddress({
          full_name: target.full_name,
          phone: target.phone,
          line1: target.line1,
          city: target.city,
          state: target.state,
          postal_code: target.postal_code,
        });
        if (!savedCheck.ok) {
          const firstIssue =
            savedCheck.invalid[0] != null
              ? checkoutAddressInvalidLabel(savedCheck.invalid[0])
              : `${checkoutAddressFieldLabel(savedCheck.missing[0])} required`;
          toast(`Saved address is incomplete (${firstIssue})`, "error");
          setStep(1);
          setAddressSheetOpen(true);
          return;
        }
      }
    }

    const checkoutValidation = await validateCartForCheckout();
    if (!checkoutValidation.ok) {
      toast(checkoutValidation.error, "error");
      router.replace("/(main)/cart");
      return;
    }

    const freshCartItems = Object.values(useCart.getState().items);
    if (freshCartItems.length === 0) {
      toast("Your bag is empty", "error");
      router.replace("/(main)/cart");
      return;
    }

    const productIds = [...new Set(freshCartItems.map((item) => item.productId))];
    const productsResult = await fetchCartProductSnapshots(productIds);
    const hold = await flushCartReservationSync(
      user.id,
      cartItemsToReservations(
        freshCartItems,
        productsResult.ok ? productsResult.products : undefined,
      ),
    );
    if (!hold.ok) {
      toast(hold.error, "error");
      router.replace("/(main)/cart");
      return;
    }

    let reservationsHeld = true;
    let orderPlaced = false;

    const freshPricingLines = freshCartItems.map((item) => ({
      storeId: item.storeId,
      quantity: item.quantity,
      unitPrice: item.price,
    }));
    const freshPointsToUse = usePoints
      ? Math.floor(
          Math.min(
            loyalty.state.points,
            Math.floor(Math.max(0, useCart.getState().subtotal() - couponDiscount)),
          ) / 100,
        ) * 100
      : 0;
    const freshTotals = computeCartTotals({
      lines: freshPricingLines,
      shippingKey,
      couponDiscount,
      pointsValue: freshPointsToUse,
      freeShippingCoupon,
    });
    const freshSub = freshTotals.sub;
    const freshPointsValue = freshPointsToUse;
    const freshShippingFee = freshTotals.shipping;
    const freshTax = freshTotals.tax;
    const freshTotal = freshTotals.total;

    setLoading(true);
    try {
      const addressId: string | null =
        selectedAddressId === "new" ? null : selectedAddressId;

      const shippingAddress = {
        full_name: fullName,
        phone,
        line1,
        line2: line2 || null,
        city,
        state,
        postal_code: postalCode,
        country,
      };

      // ---- Multi-vendor atomic placement ----
      // One RPC call (place_order_group) creates N sub-orders, N
      // commission invoices, ONE group-level payments row, and consumes
      // inventory + reservations across every store in a single
      // transaction. Coupon discount and loyalty points are split
      // proportionally to each store's subtotal share so commission
      // invoices stay consistent with what the buyer paid.
      const byStore = new Map<string, typeof freshCartItems>();
      for (const item of freshCartItems) {
        const arr = byStore.get(item.storeId) ?? [];
        arr.push(item);
        byStore.set(item.storeId, arr);
      }
      const storeGroups = Array.from(byStore.entries());

      const perStoreTotals = storeGroups.map(([storeId, items]) => {
        const lines = items.map((it) => ({
          storeId: it.storeId,
          quantity: it.quantity,
          unitPrice: it.price,
        }));
        const totals = computeCartTotals({
          lines,
          shippingKey,
          couponDiscount: 0,
          pointsValue: 0,
          freeShippingCoupon,
        });
        return { storeId, items, totals };
      });

      const totalSubForProportion = perStoreTotals.reduce(
        (sum, g) => sum + g.totals.sub,
        0,
      );

      const groupId = uuidv4();
      const ordersPayload = perStoreTotals.map((g) => {
        const share =
          totalSubForProportion > 0 ? g.totals.sub / totalSubForProportion : 0;
        const shippingFee = round2(g.totals.shipping * share);
        const tax = round2(g.totals.tax * share);
        const discount = round2((couponDiscount + freshPointsValue) * share);
        const total = Math.max(0, g.totals.sub + shippingFee + tax - discount);
        return {
          store_id: g.storeId,
          items: g.items.map((it) => ({
            product_id: it.productId,
            variant_id: it.variantId ?? null,
            product_name: it.name,
            variant_label: it.variantLabel ?? null,
            sku: null,
            quantity: it.quantity,
            unit_price: it.price,
          })),
          subtotal: g.totals.sub,
          discount,
          shipping_fee: shippingFee,
          tax,
          total,
        };
      });

      // Reservation sync was already flushed above (`flushCartReservationSync`
      // at line ~357). `place_order_group` is the single atomic writer and
      // consumes the caller's holds via `place_order_group`'s internal
      // reservation lookup. Re-syncing here would clobber the TTL with no
      // benefit and could leak holds if the group call fails.

      const { data: groupData, error: groupErr } = await (async () => {
        const res = await placeOrderGroupBackend({
          cart_groups: ordersPayload.map((row) => ({
            store_id: row.store_id,
            items: row.items
              .filter((i) => i.variant_id != null)
              .map((i) => ({
                variant_id: i.variant_id as string,
                quantity: i.quantity,
              })),
          })),
          address_id: addressId ?? "",
          payment_method: paymentMethod,
          coupon_code: couponInput.trim() || null,
          gift_card_code: giftCardCode || null,
          currency: "LKR",
        });
        if (!res.ok) return { data: null, error: { message: res.error } };
        return { data: res.data, error: null };
      })();

      if (groupErr) {
        throw new Error(groupErr.message);
      }
      const subOrders = parseGroupOrders(groupData);
      if (!subOrders || subOrders.length === 0) {
        throw new Error("Order group created but no sub-orders returned");
      }

      orderPlaced = true;
      const firstOrderId = subOrders[0].id;
      const placed = subOrders;

      if (paymentMethod === "payhere") {
        pendingLoyaltyPointsRef.current = freshPointsToUse;
        const session = await getPayHereSession(firstOrderId, { groupId });
        if (!session.ok) {
          await abandonOrderGroupBackend(groupId);
          orderPlaced = false;
          throw new Error(session.error);
        }
        setPlacedOrderId(firstOrderId);
        setPayhereSession(session.data);
        setPayhereVisible(true);
        // Stash sibling ids for the success page.
        pendingOrderIdsRef.current = placed.map((o) => o.id);
        pendingOrderIdsFirstRef.current = firstOrderId;
        await loyalty.reload();
        return;
      }

      await loyalty.reload();
      toast("Order placed", "success");
      const orderIds = placed.map((o) => o.id).join(",");
      router.replace(
        `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIds)}` as never,
      );
      await releaseCartReservations();
      reservationsHeld = false;
      clear();
    } catch (e: any) {
      if (reservationsHeld && !orderPlaced) {
        await releaseCartReservations();
      }
      toast(e?.message || "Order failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 1) {
      void restoreUnselectedCartItems(addItem).then(() => clearCheckoutSession());
      router.back();
      return;
    }
    setStep(step - 1);
  };

  const handleAddressContinue = () => {
    // When the user has picked a saved address, validate that record (it
    // may predate our required-field rules) instead of the locally cached
    // fields. Only fall back to the local fields for the "new" flow.
    const target =
      selectedAddressId !== "new"
        ? savedAddresses.find((a) => a.id === selectedAddressId) ?? null
        : null;
    const fields = target
      ? {
          full_name: target.full_name,
          phone: target.phone,
          line1: target.line1,
          city: target.city,
          state: target.state,
          postal_code: target.postal_code,
        }
      : {
          full_name: fullName,
          phone,
          line1,
          city,
          state,
          postal_code: postalCode,
        };
    const addressCheck = validateCheckoutAddress(fields);
    if (!addressCheck.ok) {
      const firstIssue =
        addressCheck.invalid[0] != null
          ? checkoutAddressInvalidLabel(addressCheck.invalid[0])
          : `${checkoutAddressFieldLabel(addressCheck.missing[0])} required`;
      toast(`Please complete your delivery address (${firstIssue})`, "error");
      setAddressSheetOpen(true);
      return;
    }
    setStep(2);
  };

  const clearCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponDiscount(0);
    setCouponId(null);
    setFreeShippingCoupon(false);
  };

  const paymentLabel = paymentMethod === "cod" ? "Cash on delivery" : "Card via PayHere";
  const addressSummary = [line1, city].filter(Boolean).join(", ");

  if (authLoading) {
    return (
      <PaperBackground style={styles.screen}>
        <ScreenHeader title="Checkout" onBack={goBack} />
        <View style={styles.authLoading}>
          <Body muted>Loading checkout…</Body>
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={styles.screen}>
      <ScreenHeader title="Checkout" onBack={goBack} />
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= s.key && styles.stepCircleActive]}>
                {step > s.key ? (
                  <Ionicons name="checkmark" size={14} color={colors.light.primaryForeground} />
                ) : (
                  <Label style={step >= s.key ? styles.stepNumActive : styles.stepNum}>{s.key}</Label>
                )}
              </View>
              <Label style={step === s.key ? styles.stepLabelActive : styles.stepLabel}>{s.label}</Label>
            </View>
            {i < STEPS.length - 1 && <View style={[styles.stepLine, step > s.key && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: step === 4 ? insets.bottom + 112 : insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {step === 1 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 01" title="Delivery address" />
            {savedAddresses.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.addressCard, selectedAddressId === a.id && styles.addressCardActive]}
                onPress={() => {
                  setSelectedAddressId(a.id);
                  fillAddress(a);
                }}
              >
                <View style={styles.addressCardBody}>
                  <View style={styles.addressCardHead}>
                    <Body size="sm" style={{ fontWeight: "600" }}>{a.full_name}</Body>
                    {a.is_default && (
                      <Label style={styles.defaultTag}>DEFAULT</Label>
                    )}
                  </View>
                  <Body muted size="xs" numberOfLines={1}>
                    {a.line1}, {a.city}
                  </Body>
                  {a.latitude && a.longitude ? (
                    <View style={styles.coordsPill}>
                      <Ionicons name="navigate-outline" size={10} color={colors.olive[700]} />
                      <Label style={styles.coordsText}>
                        PINNED · {a.latitude.toFixed(3)}, {a.longitude.toFixed(3)}
                      </Label>
                    </View>
                  ) : null}
                </View>
                {selectedAddressId === a.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.light.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addressCard, styles.addAddressCard]}
              onPress={() => setAddressSheetOpen(true)}
            >
              <View style={styles.addAddressIcon}>
                <Ionicons name="add" size={18} color={colors.light.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Body size="sm" style={{ fontWeight: "600" }}>Add a new address</Body>
                <Body muted size="xs" numberOfLines={1}>
                  Auto-detect + pin on map · saved to your account
                </Body>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
            </TouchableOpacity>
            <Button variant="brand" onPress={handleAddressContinue}>Continue</Button>
          </View>
        )}

        {step === 2 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 02" title="Shipping method" />
            {SHIPPING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionCard, shippingKey === opt.key && styles.optionCardActive]}
                onPress={() => setShippingKey(opt.key)}
              >
                <Ionicons name="car-outline" size={22} color={colors.light.primary} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }}>{opt.label}</Body>
                  <Body muted size="xs">{opt.desc}</Body>
                </View>
                <Label>{sub >= FREE_SHIPPING_THRESHOLD && opt.key === "standard" ? "FREE" : formatPrice(opt.fee)}</Label>
              </TouchableOpacity>
            ))}
            <Button variant="brand" onPress={() => setStep(3)}>Continue</Button>
          </View>
        )}

        {step === 3 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 03" title="Payment" />
            {[
              { key: "cod" as const, label: "Cash on delivery", desc: "Pay when you receive", icon: "cash-outline" as const },
              { key: "payhere" as const, label: "Card via PayHere", desc: "Visa · Mastercard · Amex", icon: "card-outline" as const },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.optionCard, paymentMethod === m.key && styles.optionCardActive]}
                onPress={() => setPaymentMethod(m.key)}
              >
                <Ionicons name={m.icon} size={22} color={colors.light.primary} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }}>{m.label}</Body>
                  <Body muted size="xs">{m.desc}</Body>
                </View>
                <View style={[styles.radio, paymentMethod === m.key && styles.radioActive]}>
                  {paymentMethod === m.key && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
            <Button variant="brand" onPress={() => setStep(4)}>Review order</Button>
          </View>
        )}

        {step === 4 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 04" title="Review & place" />

            <View style={styles.recapRow}>
              <TouchableOpacity style={styles.recapChip} onPress={() => setStep(1)} activeOpacity={0.8}>
                <View style={styles.recapIcon}>
                  <Ionicons name="location-outline" size={14} color={colors.olive[700]} />
                </View>
                <View style={styles.recapText}>
                  <Label style={styles.recapLabel}>Deliver to</Label>
                  <Body size="xs" numberOfLines={1}>{addressSummary || "—"}</Body>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.recapChip} onPress={() => setStep(2)} activeOpacity={0.8}>
                <View style={styles.recapIcon}>
                  <Ionicons name="car-outline" size={14} color={colors.olive[700]} />
                </View>
                <View style={styles.recapText}>
                  <Label style={styles.recapLabel}>Shipping</Label>
                  <Body size="xs" numberOfLines={1}>{shippingOption.label}</Body>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.recapChip} onPress={() => setStep(3)} activeOpacity={0.8}>
                <View style={styles.recapIcon}>
                  <Ionicons name={paymentMethod === "cod" ? "cash-outline" : "card-outline"} size={14} color={colors.olive[700]} />
                </View>
                <View style={styles.recapText}>
                  <Label style={styles.recapLabel}>Payment</Label>
                  <Body size="xs" numberOfLines={1}>{paymentLabel}</Body>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.itemsSection}>
              <View style={styles.itemsSectionHead}>
                <Label style={styles.itemsSectionLabel}>Your bag</Label>
                <Label style={styles.itemsCount}>{cartItems.length} item{cartItems.length === 1 ? "" : "s"}</Label>
              </View>
              {cartItems.map((item, i) => (
                <View key={buildCartLineKeyFromItem(item)} style={styles.reviewItem}>
                  <View style={styles.reviewThumb}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.reviewImage} contentFit="cover" />
                    ) : (
                      <View style={styles.reviewImagePlaceholder}>
                        <Ionicons name="bag-outline" size={18} color={colors.light.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.qtyBadge}>
                      <Label style={styles.qtyBadgeText}>{item.quantity}</Label>
                    </View>
                  </View>
                  <View style={styles.reviewItemBody}>
                    <Body size="sm" numberOfLines={2} style={styles.reviewItemName}>{item.name}</Body>
                    {item.variantLabel ? (
                      <Label style={styles.reviewVariant}>{item.variantLabel}</Label>
                    ) : null}
                    <Price size="sm" style={styles.reviewItemPrice}>
                      {formatPrice(item.price * item.quantity)}
                    </Price>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.couponCard}>
              <View style={styles.couponCardHead}>
                <Ionicons name="pricetag-outline" size={16} color={colors.olive[700]} />
                <Label style={styles.couponCardTitle}>Promo code</Label>
              </View>
              {couponCode && (couponDiscount > 0 || freeShippingCoupon) ? (
                <View style={styles.couponApplied}>
                  <View style={styles.couponAppliedLeft}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
                    <View>
                      <Body size="sm" style={{ fontWeight: "600" }}>{couponCode}</Body>
                      <Body muted size="xs">
                        {freeShippingCoupon ? "Free shipping applied" : `${formatPrice(couponDiscount)} off`}
                      </Body>
                    </View>
                  </View>
                  <TouchableOpacity onPress={clearCoupon} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.light.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    value={couponInput}
                    onChangeText={setCouponInput}
                    placeholder="Enter code"
                    placeholderTextColor={colors.light.mutedForeground}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={({ pressed }) => [styles.couponApplyBtn, pressed && { opacity: 0.85 }]}
                    onPress={applyCoupon}
                  >
                    <Label style={styles.couponApplyText}>Apply</Label>
                  </Pressable>
                </View>
              )}
            </View>

            <GiftCardBlock
              appliedCode={giftCardCode}
              appliedBalance={giftCardCredit}
              appliedCurrency={giftCardCurrency}
              onApply={async (code) => {
                const { validateGiftCardRedemption } = await import("@/lib/api");
                const res = await validateGiftCardRedemption({ code, order_currency: "LKR" });
                if (!res.ok) {
                  toast(res.error.message || "Card invalid", "error");
                  return;
                }
                if (!res.data.valid) {
                  toast(`Cannot apply: ${res.data.reason ?? "unknown"}`, "error");
                  return;
                }
                setGiftCardCode(code);
                setGiftCardCredit(Math.min(res.data.current_balance ?? 0, Math.max(0, sub - couponDiscount)));
                setGiftCardCurrency(res.data.card_currency ?? "LKR");
                toast("Gift card applied", "success");
              }}
              onRemove={() => {
                setGiftCardCode(null);
                setGiftCardCredit(0);
              }}
            />

            <View style={styles.receiptCard}>
              <Label style={styles.receiptLabel}>Price details</Label>
              <View style={styles.receiptRule} />
              <SummaryLine label="Subtotal" value={formatPrice(sub)} />
              {couponDiscount > 0 && (
                <SummaryLine label="Coupon discount" value={`-${formatPrice(couponDiscount)}`} accent />
              )}
              {pointsValue > 0 && (
                <SummaryLine label="Loyalty points" value={`-${formatPrice(pointsValue)}`} accent />
              )}
              <SummaryLine
                label="Shipping"
                value={shippingFee === 0 ? "Complimentary" : formatPrice(shippingFee)}
                accent={shippingFee === 0}
              />
              <SummaryLine label="Tax · 8%" value={formatPrice(tax)} muted />
              <View style={styles.receiptRule} />
              <View style={styles.totalRow}>
                <Display size="lg">Total</Display>
                <Price size="xl">{formatPrice(total)}</Price>
              </View>
            </View>

            {loyalty.state.points >= 100 && maxRedeemablePts >= 100 && (
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyIcon}>
                  <Ionicons name="diamond-outline" size={18} color={colors.olive[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body size="sm" style={{ fontWeight: "600" }}>Use loyalty points</Body>
                  <Body muted size="xs">
                    {usePoints
                      ? `Redeeming ${pointsToUse.toLocaleString()} pts`
                      : `Up to ${maxRedeemablePts.toLocaleString()} pts available`}
                  </Body>
                </View>
                <Switch
                  value={usePoints}
                  onValueChange={setUsePoints}
                  trackColor={{ false: colors.light.border, true: colors.olive[400] }}
                  thumbColor={usePoints ? colors.light.primary : colors.paper.DEFAULT}
                />
              </View>
            )}

            <View style={styles.earnPill}>
              <Ionicons name="sparkles-outline" size={14} color={colors.olive[700]} />
              <Body muted size="xs">Earn ≈ {earnEstimate.toLocaleString()} pts when delivered</Body>
            </View>

            <View style={styles.trustRow}>
              <TrustBadge icon="lock-closed-outline" label="Secure" />
              <View style={styles.trustDot} />
              <TrustBadge icon="return-down-back-outline" label="14-day returns" />
              <View style={styles.trustDot} />
              <TrustBadge icon="leaf-outline" label="Atelier-sourced" />
            </View>
          </View>
        )}
        </ScrollView>

        {step === 4 && (
          <View
            style={[styles.reviewFooter, { paddingBottom: insets.bottom + 12 }]}
            pointerEvents="box-none"
          >
            <View style={styles.reviewFooterTotal}>
              <Label style={styles.reviewFooterLabel}>Total payable</Label>
              <Price size="lg">{formatPrice(total)}</Price>
            </View>
            <Pressable
              style={({ pressed }) => [styles.placeOrderBtn, pressed && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={loading}
            >
              <LinearGradient
                colors={[colors.olive[500], colors.olive[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Label style={styles.placeOrderText}>
                {loading ? "Placing order…" : "Place order"}
              </Label>
              {!loading && <Ionicons name="arrow-forward" size={18} color="#fff" />}
            </Pressable>
          </View>
        )}
      </View>

      {payhereSession && placedOrderId && (
        <PayHereCheckout
          visible={payhereVisible}
          action={payhereSession.action}
          fields={payhereSession.fields}
          orderId={placedOrderId}
          confirming={confirmingPayment}
          onClose={async () => {
            if (confirmingPayment) return;
            setPayhereVisible(false);
            const orderId = placedOrderId;
            setPlacedOrderId(null);
            setPayhereSession(null);
            pendingLoyaltyPointsRef.current = 0;
            const siblingIds = pendingOrderIdsRef.current.filter((id) => id !== orderId);
            pendingOrderIdsRef.current = [];
            pendingOrderIdsFirstRef.current = null;
            if (orderId) {
              // Cancel the PayHere-anchored order. Sibling orders (from other
              // stores in the multi-vendor split) stay intact — the user may
              // pay those via cash on delivery or a follow-up.
              const res = await abandonUnpaidPayHereOrder(orderId);
              if (!res.ok) {
                toast(res.error ?? "Could not cancel order", "error");
              } else if (siblingIds.length > 0) {
                clear();
                toast(
                  `Payment cancelled — ${siblingIds.length} other order${siblingIds.length === 1 ? "" : "s"} kept for cash on delivery`,
                  "info",
                );
              } else {
                clear();
                toast("Payment cancelled — stock restored", "info");
              }
            }
            router.replace("/(main)/cart");
          }}
          onReturnFromGateway={async () => {
            if (confirmingPayment) return;
            const orderId = placedOrderId;
            if (!orderId) return;

            setConfirmingPayment(true);
            const poll = await pollOrderPaymentStatus(orderId);
            setConfirmingPayment(false);

            if (!poll.ok) {
              toast(poll.error, "error");
              router.replace(`/(main)/account/orders/${orderId}` as never);
              return;
            }

            const pts = pendingLoyaltyPointsRef.current;
            pendingLoyaltyPointsRef.current = 0;
            if (pts > 0) {
              const redeemRes = await loyalty.redeem(pts, orderId);
              if (!redeemRes.ok) {
                toast(redeemRes.error ?? "Points could not be applied", "error");
              }
            }

            setPayhereVisible(false);
            setPayhereSession(null);
            setPlacedOrderId(null);
            const allIds = pendingOrderIdsRef.current;
            pendingOrderIdsRef.current = [];
            pendingOrderIdsFirstRef.current = null;
            await releaseCartReservations();
            clear();
            await loyalty.reload();
            toast("Payment complete", "success");
            const orderIdsParam = allIds.length > 0 ? allIds.join(",") : orderId;
            router.replace(
              `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIdsParam)}` as never,
            );
          }}
        />
      )}

      <AddressFormSheet
        visible={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        onSubmit={handleNewAddressSubmit}
        title="Delivery address"
        subtitle="Auto-detect location or drop a pin"
        primaryLabel="Use this address"
        hideDefault
        defaultName={user?.user_metadata?.full_name ?? ""}
        defaultPhone={(user?.user_metadata?.phone as string) ?? ""}
      />
    </PaperBackground>
  );
}

function SummaryLine({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryLine}>
      <Body muted={muted} size="sm">{label}</Body>
      <Body
        size="sm"
        style={accent ? { color: colors.olive[600], fontFamily: fontFamilies.sans.semibold } : undefined}
      >
        {value}
      </Body>
    </View>
  );
}

function TrustBadge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.trustBadge}>
      <Ionicons name={icon} size={12} color={colors.light.mutedForeground} />
      <Label style={styles.trustLabel}>{label}</Label>
    </View>
  );
}

function GiftCardBlock({
  appliedCode,
  appliedBalance,
  appliedCurrency,
  onApply,
  onRemove,
}: {
  appliedCode: string | null;
  appliedBalance: number;
  appliedCurrency: string;
  onApply: (code: string) => Promise<void> | void;
  onRemove: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (appliedCode) {
    return (
      <View style={styles.couponCard}>
        <View style={styles.couponCardHead}>
          <Ionicons name="gift-outline" size={16} color={colors.olive[700]} />
          <Label style={styles.couponCardTitle}>Gift card</Label>
        </View>
        <View style={styles.couponApplied}>
          <View style={styles.couponAppliedLeft}>
            <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
            <View>
              <Body size="sm" style={{ fontWeight: "600" }}>{appliedCode}</Body>
              <Body muted size="xs">
                {formatPrice(appliedBalance, appliedCurrency)} will apply at checkout
              </Body>
            </View>
          </View>
          <TouchableOpacity onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.couponCard}>
      <View style={styles.couponCardHead}>
        <Ionicons name="gift-outline" size={16} color={colors.olive[700]} />
        <Label style={styles.couponCardTitle}>Gift card</Label>
      </View>
      <View style={styles.couponInputRow}>
        <TextInput
          style={styles.couponInput}
          value={code}
          onChangeText={setCode}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={colors.light.mutedForeground}
          autoCapitalize="characters"
          maxLength={40}
        />
        <Pressable
          style={({ pressed }) => [styles.couponApplyBtn, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            const trimmed = code.trim();
            if (trimmed.length < 4) return;
            setBusy(true);
            await onApply(trimmed);
            setBusy(false);
          }}
          disabled={busy || code.length < 4}
        >
          <Label style={styles.couponApplyText}>{busy ? "…" : "Apply"}</Label>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[5],
  },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: spacing[4],
    gap: 4,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  stepNum: { color: colors.light.mutedForeground, fontSize: 10 },
  stepNumActive: { color: colors.light.primaryForeground, fontSize: 10 },
  stepLabel: { color: colors.light.mutedForeground, fontSize: 9 },
  stepLabelActive: { color: colors.light.primary, fontSize: 9 },
  stepLine: { width: 24, height: 1, backgroundColor: colors.light.border, marginBottom: 16 },
  stepLineActive: { backgroundColor: colors.light.primary },
  content: { paddingHorizontal: 20 },
  panel: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[5],
    gap: spacing[3],
    ...shadows.soft,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    gap: spacing[3],
  },
  addressCardActive: { borderColor: colors.light.primary, backgroundColor: colors.olive[50] },
  addressCardBody: { flex: 1, gap: 4 },
  addressCardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  defaultTag: {
    fontFamily: "JetBrainsMono_600SemiBold",
    fontSize: 9,
    color: colors.olive[700],
    backgroundColor: colors.olive[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.4,
  },
  addAddressCard: { borderStyle: "dashed", borderColor: colors.olive[200] },
  addAddressIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  coordsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    marginTop: 2,
  },
  coordsText: {
    color: colors.olive[700],
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 9,
    letterSpacing: 0.4,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  optionCardActive: { borderColor: colors.light.primary, backgroundColor: colors.olive[50] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.light.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.light.primary },

  recapRow: { gap: spacing[2] },
  recapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  recapIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  recapText: { flex: 1, gap: 2 },
  recapLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  itemsSection: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[3],
    gap: spacing[3],
  },
  itemsSectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing[1],
  },
  itemsSectionLabel: {
    color: colors.olive[700],
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  itemsCount: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  reviewItem: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
  },
  reviewThumb: {
    width: 72,
    height: 88,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.light.muted,
    position: "relative",
  },
  reviewImage: { width: "100%", height: "100%" },
  reviewImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  qtyBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
  },
  reviewItemBody: { flex: 1, gap: 4, paddingTop: 2 },
  reviewItemName: { fontFamily: fontFamilies.sans.medium, lineHeight: 20 },
  reviewVariant: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reviewItemPrice: { marginTop: 4 },

  couponCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[4],
    gap: spacing[3],
  },
  couponCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  couponCardTitle: {
    color: colors.olive[700],
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  couponInputRow: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "center",
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    paddingHorizontal: spacing[3],
    fontSize: 14,
    fontFamily: fontFamilies.mono.medium,
    color: colors.light.foreground,
    letterSpacing: 1,
  },
  couponApplyBtn: {
    height: 44,
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplyText: {
    color: colors.light.primary,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  couponAppliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flex: 1,
  },

  receiptCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[4],
    gap: spacing[2],
  },
  receiptLabel: {
    color: colors.olive[700],
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  receiptRule: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing[1],
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing[1],
  },

  loyaltyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.olive[200],
    backgroundColor: colors.olive[50],
  },
  loyaltyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },

  earnPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[2],
  },

  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trustLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.light.border,
  },

  reviewFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.light.card,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    ...shadows.editorial,
  },
  reviewFooterTotal: { flex: 1, gap: 2 },
  reviewFooterLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    height: 52,
    minWidth: 168,
    paddingHorizontal: spacing[5],
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  placeOrderText: {
    color: "#fff",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: fontFamilies.sans.semibold,
  },
});
