import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader, SectionHeader } from "@/components/layout";
import {
  AddressFormSheet,
  type AddressFormPayload,
} from "@/components/address/AddressFormSheet";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/utils";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { useLoyalty } from "@/lib/hooks/useLoyalty";
import { getPaymentsLkSession, getGuestPaymentsLkSession, getStripeCheckoutSession, pollOrderPaymentStatus } from "@/lib/api/payments";
import { runPaymentsLkCheckout } from "@/lib/paymentslk-checkout";
import * as WebBrowser from "expo-web-browser";
import { placeOrderGroupBackend, placeGuestOrderBackend, abandonOrderGroupBackend, getCheckoutOptionsBackend } from "@/lib/api/backend";
import { Label, Body } from "@/components/ui/Typography";
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
  abandonUnpaidCardOrder,
  cartItemsToReservations,
  flushCartReservationSync,
  releaseCartReservations,
} from "@/lib/inventory-reservations";
import {
  formatPrice,
  SHIPPING_OPTIONS,
  type ShippingKey,
} from "@/lib/utils";
import { computeCartTotals, computeOrderShipping, GIFT_WRAP_FEE } from "@/lib/cart-pricing";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";
import { useTrackCheckoutStarted } from "@/lib/recommender";

const STEPS = [
  { key: 1, label: "Address" },
  { key: 2, label: "Shipping" },
  { key: 3, label: "Payment" },
  { key: 4, label: "Review" },
];

const PAYMENTS_LK_ENABLED = process.env.EXPO_PUBLIC_PAYMENTS_LK_ENABLED === "true";
const STRIPE_ENABLED = process.env.EXPO_PUBLIC_STRIPE_ENABLED === "true";

/** Parse the place_order_group RPC response into a flat list of sub-orders. */
function parseGroupOrders(data: unknown): {
  orders: { id: string; order_number?: string; store_id?: string; total?: number }[];
  groupId: string | null;
} {
  if (!data || typeof data !== "object") return { orders: [], groupId: null };
  const row = data as { orders?: unknown; group?: { orders?: unknown; group_id?: string }; group_id?: string };
  const nested = row.group && typeof row.group === "object" ? row.group : null;
  const ordersRaw = Array.isArray(row.orders)
    ? row.orders
    : Array.isArray(nested?.orders)
      ? nested.orders
      : [];
  const out: { id: string; order_number?: string; store_id?: string; total?: number }[] = [];
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
  const groupId =
    typeof row.group_id === "string"
      ? row.group_id
      : typeof nested?.group_id === "string"
        ? nested.group_id
        : null;
  return { orders: out, groupId };
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
  const { openAddress, guest } = useLocalSearchParams<{ openAddress?: string; guest?: string }>();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const loyalty = useLoyalty();
  const { items, subtotal, couponCode, setCoupon, clear, addItem } = useCart();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const pendingLoyaltyPointsRef = useRef(0);
  /** Synchronous re-entrancy guard for handlePlaceOrder — set before any
   *  `await` so a second tap during the pre-`setLoading` validation phase
   *  (address/cart checks, reservation hold) is a no-op instead of racing
   *  the first tap into placing a duplicate order. */
  const isSubmittingRef = useRef(false);
  /** Order ids created during a multi-vendor place_order fan-out. The first
   *  id is the payment-anchored order; the rest are tracked alongside it. */
  const pendingOrderIdsRef = useRef<string[]>([]);
  /** The order id the card checkout is currently processing (subset of
   *  pendingOrderIdsRef). */
  const pendingOrderIdsFirstRef = useRef<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [couponInput, setCouponInput] = useState(couponCode || "");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [freeShippingCoupon, setFreeShippingCoupon] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState<string | null>(null);
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardCurrency, setGiftCardCurrency] = useState("LKR");
  const [codAllowed, setCodAllowed] = useState<boolean | null>(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Sri Lanka");
  const [shippingKey, setShippingKey] = useState<ShippingKey>("standard");
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "paymentslk" | "stripe">("cod");
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const isGuest = guest === "1" && !user;

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
        giftCardCredit: giftCardBalance,
        giftWrapCount: cartItems.filter((i) => i.is_gift).length,
      }),
    [pricingLines, shippingKey, couponDiscount, pointsToUse, freeShippingCoupon, giftCardBalance, cartItems],
  );
  const sub = checkoutTotals.sub;
  const shippingFee = checkoutTotals.shipping;
  const giftWrapFee = cartItems.filter((i) => i.is_gift).length * GIFT_WRAP_FEE;
  const afterCoupon = checkoutTotals.afterCoupon;
  const pointsValue = pointsToUse;
  const tax = checkoutTotals.tax;
  const total = checkoutTotals.total;
  const giftApplied = checkoutTotals.giftApplied;

  // Fire checkout_started once when the user reaches the address step with a
  // non-empty bag. Mirrors web's behaviour.
  useTrackCheckoutStarted(sub, cartItems.length);
  const earnEstimate = Math.floor(afterCoupon * 0.05);
  // Max redeemable points: capped at balance and post-coupon subtotal (100-pt blocks).
  const maxRedeemablePts =
    Math.floor(Math.min(loyalty.state.points, Math.floor(Math.max(0, sub - couponDiscount))) / 100) * 100;
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.key === shippingKey) ?? SHIPPING_OPTIONS[0];

  useEffect(() => {
    if (authLoading) return;
    if (!user && !isGuest) {
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
  }, [authLoading, user, isGuest, items, router, toast]);

  const storeIds = useMemo(
    () => Array.from(new Set(Object.values(items).map((item) => item.storeId))),
    [items],
  );
  useEffect(() => {
    if (!user || storeIds.length === 0) {
      setCodAllowed(true);
      return;
    }
    let cancelled = false;
    setCodAllowed(null);
    void getCheckoutOptionsBackend(storeIds).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setCodAllowed(false);
        return;
      }
      setCodAllowed(!!res.data.cod_allowed);
    });
    return () => {
      cancelled = true;
    };
  }, [user, storeIds]);

  useEffect(() => {
    if (codAllowed === false && paymentMethod === "cod") {
      const fallback = PAYMENTS_LK_ENABLED
        ? "paymentslk"
        : STRIPE_ENABLED && !isGuest
          ? "stripe"
          : null;
      if (fallback) setPaymentMethod(fallback);
    }
  }, [codAllowed, paymentMethod, isGuest]);

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
    if (!user && guest === "1" && openAddress === "1") {
      setAddressSheetOpen(true);
    }
  }, [authLoading, user, guest, openAddress]);

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
    const local = {
      id: "guest",
      user_id: user?.id ?? "",
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
    } as Address;
    if (!user) {
      fillAddress(local);
      setSelectedAddressId("new");
      setAddressSheetOpen(false);
      toast("Delivery address set", "success");
      return;
    }
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

  const handleAddressSheetSubmit = async (payload: AddressFormPayload) => {
    if (editingAddress) {
      if (!user) {
        const local = {
          ...editingAddress,
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
        } as Address;
        fillAddress(local);
        setEditingAddress(null);
        toast("Address updated", "success");
        return;
      }
      const updatePayload = {
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
      };
      const res = await api.updateAddress(editingAddress.id, updatePayload as any);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      const updated = res.data;
      setSavedAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (selectedAddressId === updated.id) {
        fillAddress(updated);
      }
      setEditingAddress(null);
      toast("Address updated", "success");
      return;
    }
    await handleNewAddressSubmit(payload);
  };

  const applyCoupon = async () => {
    if (!user) return;
    const trimmed = couponInput.trim();
    if (!trimmed) {
      toast("Enter a coupon code first", "error");
      return;
    }
    const validationLines = cartItems.map((item) => ({
      product_id: item.productId,
      store_id: item.storeId,
      quantity: item.quantity,
      unit_price: item.price,
    }));
    const res = await api.validateCoupon(trimmed, user.id, sub, validationLines);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    if (res.data.message !== "Coupon applied" && res.data.message !== "Free shipping") {
      toast(res.data.message || "Coupon cannot be applied", "error");
      return;
    }
    setCoupon(trimmed.toUpperCase());
    setCouponId(res.data.couponId);
    setCouponDiscount(res.data.message === "Free shipping" ? 0 : res.data.discount);
    setFreeShippingCoupon(res.data.message === "Free shipping");
    toast("Coupon applied", "success");
  };

  const clearCoupon = useCallback(() => {
    setCoupon(null);
    setCouponInput("");
    setCouponDiscount(0);
    setCouponId(null);
    setFreeShippingCoupon(false);
  }, [setCoupon]);

  // Re-validate the applied coupon whenever the cart subtotal changes. The
  // discount returned by `validateCoupon` is anchored to the subtotal at
  // apply-time, so a stock-driven cart edit (item removed, qty capped) can
  // leave the buyer with a discount that no longer satisfies
  // min_order_value, or a stale discount number.
  useEffect(() => {
    if (!user || !couponId || !couponCode) return;
    let cancelled = false;
    const validationLines = Object.values(items).map((item) => ({
      product_id: item.productId,
      store_id: item.storeId,
      quantity: item.quantity,
      unit_price: item.price,
    }));
    api.validateCoupon(couponCode, user.id, sub, validationLines).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        clearCoupon();
        toast(`Coupon no longer valid: ${res.error}`, "error");
        return;
      }
      if (res.data.message === "Free shipping") {
        setCouponDiscount(0);
        setFreeShippingCoupon(true);
      } else if (res.data.message === "Coupon applied") {
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
  }, [user, couponId, couponCode, sub, items, clearCoupon, toast]);

  const handlePlaceOrder = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
    if (authLoading) return;
    if (!user && !isGuest) {
      toast("Please sign in to place your order", "error");
      router.replace("/(auth)/login");
      return;
    }
    if (isGuest) {
      const email = guestEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast("Enter a valid email so we can send your receipt", "error");
        setStep(1);
        return;
      }
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

    if (paymentMethod === "cod" && codAllowed === false) {
      toast("Cash on delivery is not available for this bag", "error");
      setStep(3);
      return;
    }
    if (paymentMethod === "cod" && codAllowed === null) {
      toast("Verifying cash-on-delivery availability…", "error");
      return;
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

    if (!isGuest && user) {
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
    }

    let reservationsHeld = !isGuest;
    let orderPlaced = false;

    const freshPointsToUse = usePoints
      ? Math.floor(
          Math.min(
            loyalty.state.points,
            Math.floor(Math.max(0, useCart.getState().subtotal() - couponDiscount)),
          ) / 100,
        ) * 100
      : 0;


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
          giftWrapCount: items.filter((i) => i.is_gift).length,
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
        const discount = round2((couponDiscount + freshPointsToUse) * share);
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
            is_gift: !!it.is_gift,
            gift_message: it.is_gift ? (it.gift_message ?? null) : null,
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
        const payload = {
          orders: ordersPayload,
          address_id: isGuest ? null : addressId,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          coupon_id: couponId,
          coupon_code: couponInput.trim() || null,
          gift_card_code: giftCardCode || null,
          currency: "LKR" as const,
          shipping_method: shippingKey,
          loyalty_points_redeemed: isGuest ? 0 : freshPointsToUse,
          group_id: groupId,
          delivery_date: deliveryDate,
        };
        const res = isGuest
          ? await placeGuestOrderBackend({ ...payload, guest_email: guestEmail.trim() })
          : await placeOrderGroupBackend(payload);
        if (!res.ok) return { data: null, error: { message: res.error } };
        return { data: res.data, error: null };
      })();

      if (groupErr) {
        throw new Error(groupErr.message);
      }
      if (isGuest) {
        const token = (groupData as { guest_token?: string } | null)?.guest_token;
        orderPlaced = true;
        if (paymentMethod === "paymentslk") {
          const session = await getGuestPaymentsLkSession(token ?? "", guestEmail.trim());
          if (!session.ok) {
            throw new Error(session.error);
          }
          const result = await runPaymentsLkCheckout(session.data.url);
          await releaseCartReservations();
          reservationsHeld = false;
          clear();
          if (result.status === "succeeded") {
            toast("Payment submitted — check your guest order status", "success");
          } else {
            toast("Payment was not completed — look up your order to retry", "info");
          }
          router.replace(
            `/(main)/orders/guest-lookup?token=${encodeURIComponent(token ?? "")}&email=${encodeURIComponent(guestEmail.trim())}` as never,
          );
          return;
        }
        await releaseCartReservations();
        reservationsHeld = false;
        clear();
        toast("Order placed", "success");
        router.replace(
          `/(main)/orders/guest-lookup?token=${encodeURIComponent(token ?? "")}&email=${encodeURIComponent(guestEmail.trim())}` as never,
        );
        return;
      }
      const parsedGroup = parseGroupOrders(groupData);
      const subOrders = parsedGroup.orders;
      const placedGroupId = parsedGroup.groupId ?? groupId;
      if (!subOrders || subOrders.length === 0) {
        throw new Error("Order group created but no sub-orders returned");
      }

      orderPlaced = true;
      const firstOrderId = subOrders[0].id;
      const placed = subOrders;

      // Shared tails for hosted card checkouts (Payments.lk + Stripe):
      // on a confirmed payment redeem loyalty + clear + go to success;
      // on cancel/failure abandon the unpaid order (siblings stay COD).
      const finalizePaidCheckout = async () => {
        const pts = pendingLoyaltyPointsRef.current;
        pendingLoyaltyPointsRef.current = 0;
        if (pts > 0) {
          const redeemRes = await loyalty.redeem(pts, firstOrderId);
          if (!redeemRes.ok) {
            toast(redeemRes.error ?? "Points could not be applied", "error");
          }
        }
        const allIds = pendingOrderIdsRef.current;
        pendingOrderIdsRef.current = [];
        pendingOrderIdsFirstRef.current = null;
        await releaseCartReservations();
        reservationsHeld = false;
        clear();
        await loyalty.reload();
        toast("Payment complete", "success");
        const orderIdsParam = allIds.length > 0 ? allIds.join(",") : firstOrderId;
        router.replace(
          `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIdsParam)}` as never,
        );
      };

      const abandonCardCheckout = async (dismissed: boolean) => {
        const siblingIds = pendingOrderIdsRef.current.filter((id) => id !== firstOrderId);
        pendingOrderIdsRef.current = [];
        pendingOrderIdsFirstRef.current = null;
        pendingLoyaltyPointsRef.current = 0;
        const res = await abandonUnpaidCardOrder(firstOrderId);
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
          toast(
            dismissed
              ? "Payment cancelled — stock restored"
              : "Payment not completed — stock restored",
            "info",
          );
        }
        router.replace("/(main)/cart");
      };

      if (paymentMethod === "paymentslk") {
        pendingLoyaltyPointsRef.current = freshPointsToUse;
        const session = await getPaymentsLkSession(firstOrderId, { groupId: placedGroupId });
        if (!session.ok) {
          await abandonOrderGroupBackend(placedGroupId);
          orderPlaced = false;
          throw new Error(session.error);
        }
        pendingOrderIdsRef.current = placed.map((o) => o.id);
        pendingOrderIdsFirstRef.current = firstOrderId;
        await loyalty.reload();

        const result = await runPaymentsLkCheckout(session.data.url);
        if (result.status === "succeeded") {
          setConfirmingPayment(true);
          const poll = await pollOrderPaymentStatus(firstOrderId);
          setConfirmingPayment(false);
          if (!poll.ok) {
            toast(poll.error, "error");
            router.replace(`/(main)/account/orders/${firstOrderId}` as never);
            return;
          }
          await finalizePaidCheckout();
          return;
        }

        // failed / canceled / expired / dismissed → abandon the unpaid order
        await abandonCardCheckout(result.status === "dismissed");
        return;
      }

      if (paymentMethod === "stripe") {
        pendingLoyaltyPointsRef.current = freshPointsToUse;
        const session = await getStripeCheckoutSession(firstOrderId, { groupId: placedGroupId });
        if (!session.ok) {
          await abandonOrderGroupBackend(placedGroupId);
          orderPlaced = false;
          throw new Error(session.error);
        }
        pendingOrderIdsRef.current = placed.map((o) => o.id);
        pendingOrderIdsFirstRef.current = firstOrderId;
        await loyalty.reload();

        // Stripe's hosted page can't deep-link back into the app, so it
        // opens in a browser sheet; once the buyer returns, the
        // webhook-backed status poll decides success vs. abandonment.
        await WebBrowser.openBrowserAsync(session.data.url);
        setConfirmingPayment(true);
        const poll = await pollOrderPaymentStatus(firstOrderId, {
          maxAttempts: 25,
          intervalMs: 3000,
        });
        setConfirmingPayment(false);
        if (poll.ok) {
          await finalizePaidCheckout();
          return;
        }
        await abandonCardCheckout(true);
        return;
      }

      if (freshPointsToUse > 0) {
        await loyalty.redeem(freshPointsToUse, firstOrderId);
      }
      await loyalty.reload();
      await releaseCartReservations();
      reservationsHeld = false;
      clear();
      toast("Order placed", "success");
      const orderIds = placed.map((o) => o.id).join(",");
      router.replace(
        `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIds)}` as never,
      );
    } catch (e: any) {
      if (reservationsHeld && !orderPlaced) {
        await releaseCartReservations();
      }
      toast(e?.message || "Order failed", "error");
    } finally {
      setLoading(false);
    }
    } finally {
      isSubmittingRef.current = false;
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

  const paymentLabel =
    paymentMethod === "cod"
      ? "Cash on delivery"
      : paymentMethod === "stripe"
        ? "Card via Stripe"
        : "Card via Payments.lk";
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
              <View
                style={[
                  styles.stepCircle,
                  step > s.key && styles.stepCircleDone,
                  step === s.key && styles.stepCircleActive,
                ]}
              >
                {step > s.key ? (
                  <Ionicons name="checkmark" size={14} color={colors.paper.cream} />
                ) : (
                  <Text style={step === s.key ? styles.stepNumActive : styles.stepNum}>
                    {s.key}
                  </Text>
                )}
              </View>
              <Text style={step === s.key ? styles.stepLabelActive : styles.stepLabel}>
                {s.label.toUpperCase()}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={styles.stepLineWrap}>
                <View style={[styles.stepLine, step > s.key && styles.stepLineActive]} />
              </View>
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.contextStrip}>
        <View style={styles.contextIcon}>
          <Ionicons name="bag-handle-outline" size={14} color={colors.olive[800]} />
        </View>
        <Text style={styles.contextText} numberOfLines={1}>
          {cartItems.length} item{cartItems.length === 1 ? "" : "s"} in your bag
        </Text>
        <Text style={styles.contextPrice}>{formatPrice(total)}</Text>
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
            {isGuest ? (
              <View style={styles.guestEmailCard}>
                <View style={styles.guestEmailIcon}>
                  <Ionicons name="mail-outline" size={16} color={colors.olive[700]} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Label style={styles.guestEmailLabel}>EMAIL FOR RECEIPT</Label>
                  <TextInput
                    value={guestEmail}
                    onChangeText={setGuestEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.guestEmailInput}
                  />
                </View>
              </View>
            ) : null}
            {savedAddresses.map((a) => {
              const selected = selectedAddressId === a.id;
              const typeIcon =
                a.type === "work"
                  ? "briefcase-outline"
                  : a.type === "other"
                    ? "location-outline"
                    : "home-outline";
              const formattedAddress = [a.line1, a.line2, a.city, a.postal_code]
                .filter(Boolean)
                .join(", ");
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.addressCard, selected && styles.addressCardActive]}
                  onPress={() => {
                    setSelectedAddressId(a.id);
                    fillAddress(a);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${a.full_name}, ${formattedAddress}`}
                >
                  <View style={styles.addressCardTop}>
                    <View style={styles.addressLeftCol}>
                      <View
                        style={[
                          styles.addressTypeTile,
                          selected && styles.addressTypeTileActive,
                        ]}
                      >
                        <Ionicons
                          name={typeIcon}
                          size={16}
                          color={selected ? colors.paper.cream : colors.olive[800]}
                        />
                      </View>
                      <View style={styles.addressHeadInfo}>
                        <View style={styles.nameBadgeRow}>
                          <Text style={styles.addressName} numberOfLines={1}>
                            {a.full_name}
                          </Text>
                          <View style={styles.badgeRow}>
                            <View style={styles.typeBadge}>
                              <Text style={styles.typeBadgeText}>{a.type.toUpperCase()}</Text>
                            </View>
                            {a.is_default ? (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.addressRadio, selected && styles.addressRadioActive]}>
                      {selected ? (
                        <Ionicons name="checkmark" size={12} color={colors.paper.cream} />
                      ) : null}
                    </View>
                  </View>

                  <Text style={styles.addressText} numberOfLines={2}>
                    {formattedAddress}
                  </Text>

                  <View style={styles.metaRow}>
                    {a.phone ? (
                      <View style={styles.phoneChip}>
                        <Ionicons name="call-outline" size={11} color={colors.light.mutedForeground} />
                        <Text style={styles.phoneText}>{a.phone}</Text>
                      </View>
                    ) : null}
                    {a.latitude && a.longitude ? (
                      <View style={styles.pinnedChip}>
                        <View style={styles.pinnedDot} />
                        <Ionicons name="location-outline" size={11} color={colors.olive[700]} />
                        <Text style={styles.pinnedText}>Pinned on map</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.addressCardFooter}>
                    {selected ? (
                      <View style={styles.selectedTag}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.olive[700]} />
                        <Text style={styles.selectedTagText}>Deliver to this address</Text>
                      </View>
                    ) : (
                      <Text style={styles.tapToSelectText}>Tap to select</Text>
                    )}

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditingAddress(a);
                      }}
                      hitSlop={10}
                      style={styles.editBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Edit address"
                    >
                      <Ionicons name="pencil-outline" size={12} color={colors.olive[700]} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.addAddressCard}
              onPress={() => {
                setEditingAddress(null);
                setAddressSheetOpen(true);
              }}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Add a new address"
            >
              <View style={styles.addAddressIconWrap}>
                <Ionicons name="add" size={20} color={colors.olive[800]} />
              </View>
              <View style={styles.addAddressCopy}>
                <Text style={styles.addAddressTitle}>Add a new address</Text>
                <Text style={styles.addAddressSubtitle}>
                  Auto-detect location or drop a pin on map
                </Text>
              </View>
              <View style={styles.addAddressChevronWrap}>
                <Ionicons name="chevron-forward" size={14} color={colors.olive[800]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleAddressContinue}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Continue to shipping"
            >
              <Text style={styles.continueBtnText}>Continue to Shipping</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 02" title="Shipping method" />

            <View style={styles.deliverToCard}>
              <View style={styles.deliverToLeft}>
                <View style={styles.deliverToIcon}>
                  <Ionicons name="location-sharp" size={16} color={colors.olive[800]} />
                </View>
                <View style={styles.deliverToInfo}>
                  <Text style={styles.deliverToKicker}>DELIVERING TO</Text>
                  <Text style={styles.deliverToAddress} numberOfLines={1}>
                    {addressSummary || "Select an address"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deliverToChangeBtn}
                onPress={() => setStep(1)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Change delivery address"
              >
                <Ionicons name="pencil-outline" size={12} color={colors.olive[800]} />
                <Text style={styles.deliverToChangeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {SHIPPING_OPTIONS.map((opt) => {
              const selected = shippingKey === opt.key;
              const icon =
                opt.key === "overnight"
                  ? "rocket-outline"
                  : opt.key === "express"
                    ? "flash-outline"
                    : "cube-outline";
              const cost = computeOrderShipping(pricingLines, opt.key, {
                freeShippingCoupon,
              });
              const arrivalFmt = (d: Date) =>
                d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
              const minArrival = new Date();
              minArrival.setDate(minArrival.getDate() + opt.minDays);
              const maxArrival = new Date();
              maxArrival.setDate(maxArrival.getDate() + opt.maxDays);
              const arrival =
                opt.minDays === opt.maxDays
                  ? arrivalFmt(minArrival)
                  : `${arrivalFmt(minArrival)} – ${arrivalFmt(maxArrival)}`;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.shippingCard, selected && styles.shippingCardActive]}
                  onPress={() => setShippingKey(opt.key)}
                  activeOpacity={0.88}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.shippingIconTile, selected && styles.shippingIconTileActive]}>
                    <Ionicons
                      name={icon}
                      size={18}
                      color={selected ? colors.paper.cream : colors.olive[800]}
                    />
                  </View>
                  <View style={styles.shippingInfo}>
                    <View style={styles.shippingHeaderRow}>
                      <Text style={styles.shippingTitle}>{opt.label}</Text>
                      {opt.key === "overnight" && (
                        <View style={styles.fastestBadge}>
                          <Text style={styles.fastestBadgeText}>FASTEST</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.shippingDesc}>{opt.desc}</Text>
                    <View style={[styles.shippingArrivalPill, selected && styles.shippingArrivalPillActive]}>
                      <Ionicons
                        name="calendar-outline"
                        size={11}
                        color={selected ? colors.olive[800] : colors.olive[700]}
                      />
                      <Text style={[styles.shippingArrivalText, selected && styles.shippingArrivalTextActive]}>
                        Arrives {arrival}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.shippingRight}>
                    {cost === 0 ? (
                      <View style={styles.shippingFreeBadge}>
                        <Text style={styles.shippingFreeBadgeText}>FREE</Text>
                      </View>
                    ) : (
                      <Text style={styles.shippingFeeText}>+{formatPrice(cost)}</Text>
                    )}
                    <View style={[styles.shippingRadio, selected && styles.shippingRadioActive]}>
                      {selected && (
                        <Ionicons name="checkmark" size={13} color={colors.paper.cream} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {(() => {
              const merchSub = pricingLines.reduce(
                (sum, l) => sum + l.quantity * l.unitPrice,
                0,
              );
              if (freeShippingCoupon) {
                return (
                  <View style={[styles.shippingBanner, styles.shippingBannerUnlocked]}>
                    <View style={[styles.shippingBannerIcon, styles.shippingBannerIconUnlocked]}>
                      <Ionicons name="pricetag" size={13} color={colors.olive[800]} />
                    </View>
                    <Text style={styles.shippingBannerTextUnlocked}>
                      Free-shipping coupon applied — every option is on us.
                    </Text>
                  </View>
                );
              }
              if (merchSub >= FREE_SHIPPING_THRESHOLD) {
                return (
                  <View style={[styles.shippingBanner, styles.shippingBannerUnlocked]}>
                    <View style={[styles.shippingBannerIcon, styles.shippingBannerIconUnlocked]}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.olive[800]} />
                    </View>
                    <Text style={styles.shippingBannerTextUnlocked}>
                      Free delivery unlocked — every shipping option ships free.
                    </Text>
                  </View>
                );
              }
              return (
                <View style={styles.shippingBanner}>
                  <View style={styles.shippingBannerIcon}>
                    <Ionicons name="sparkles" size={13} color={colors.accent2.ochre} />
                  </View>
                  <Text style={styles.shippingBannerText}>
                    Add <Text style={styles.shippingBannerHighlight}>{formatPrice(FREE_SHIPPING_THRESHOLD - merchSub)}</Text> more to unlock free delivery on every option.
                  </Text>
                </View>
              );
            })()}

            <View style={styles.deliveryDateSection}>
              <SectionHeader kicker="Optional" title="Delivery date" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateScrollContent}
              >
                <TouchableOpacity
                  onPress={() => setDeliveryDate(null)}
                  style={[styles.dateChipNew, deliveryDate === null && styles.dateChipNewActive]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Flexible delivery date"
                >
                  <Text style={[styles.dateChipKicker, deliveryDate === null && styles.dateChipKickerActive]}>
                    ANY
                  </Text>
                  <Text
                    style={[styles.dateChipMain, deliveryDate === null && styles.dateChipMainActive]}
                  >
                    Flexible
                  </Text>
                </TouchableOpacity>
                {[1, 2, 3, 5].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const iso = d.toISOString().slice(0, 10);
                  const weekday = d.toLocaleDateString("en-LK", { weekday: "short" }).toUpperCase();
                  const dayMonth = d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
                  const active = deliveryDate === iso;
                  return (
                    <TouchableOpacity
                      key={iso}
                      onPress={() => setDeliveryDate(active ? null : iso)}
                      style={[styles.dateChipNew, active && styles.dateChipNewActive]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Delivery date ${weekday} ${dayMonth}`}
                    >
                      <Text style={[styles.dateChipKicker, active && styles.dateChipKickerActive]}>
                        {weekday}
                      </Text>
                      <Text
                        style={[styles.dateChipMain, active && styles.dateChipMainActive]}
                      >
                        {dayMonth}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => setStep(3)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Continue to payment"
            >
              <Text style={styles.continueBtnText}>Continue to Payment</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 03" title="Payment" />

            <View style={styles.deliverToCard}>
              <View style={styles.deliverToLeft}>
                <View style={styles.deliverToIcon}>
                  <Ionicons name="cube-outline" size={16} color={colors.olive[800]} />
                </View>
                <View style={styles.deliverToInfo}>
                  <Text style={styles.deliverToKicker}>SHIPPING VIA {shippingOption.label.toUpperCase()}</Text>
                  <Text style={styles.deliverToAddress} numberOfLines={1}>
                    {addressSummary || "Address selected"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deliverToChangeBtn}
                onPress={() => setStep(2)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Change shipping or address"
              >
                <Ionicons name="pencil-outline" size={12} color={colors.olive[800]} />
                <Text style={styles.deliverToChangeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {codAllowed === false && (
              <View style={styles.codNotice}>
                <View style={styles.codNoticeIconWrap}>
                  <Ionicons name="alert-circle" size={16} color={colors.accent2.rust} />
                </View>
                <View style={styles.codNoticeCopy}>
                  <Text style={styles.codNoticeTitle}>Cash on delivery unavailable</Text>
                  <Text style={styles.codNoticeDesc}>
                    One or more sellers in this bag do not accept COD. Please pay by card.
                  </Text>
                </View>
              </View>
            )}

            {([
              {
                key: "cod" as const,
                label: "Cash on delivery",
                desc: "Pay when you receive your order",
                badge: "PAY AT DOOR",
                badgeType: "olive" as const,
                icon: "cash-outline" as const,
                brands: [],
              },
              ...(PAYMENTS_LK_ENABLED
                ? [
                    {
                      key: "paymentslk" as const,
                      label: "Card via Payments.lk",
                      desc: "Instant & encrypted card checkout",
                      badge: "100% SECURE",
                      badgeType: "ochre" as const,
                      icon: "card-outline" as const,
                      brands: ["VISA", "MASTERCARD", "AMEX", "LANKAQR"],
                    },
                  ]
                : []),
              // Stripe is sign-in only — the hosted session is bound to
              // the authenticated user's orders (no guest token flow).
              ...(STRIPE_ENABLED && !isGuest
                ? [
                    {
                      key: "stripe" as const,
                      label: "Card via Stripe",
                      desc: "Global cards & wallets, 3-D Secure protected",
                      badge: "3D SECURE",
                      badgeType: "olive" as const,
                      icon: "lock-closed-outline" as const,
                      brands: ["VISA", "MASTERCARD", "AMEX"],
                    },
                  ]
                : []),
            ] as const)
              .filter((m) => !(m.key === "cod" && codAllowed === false))
              .map((m) => {
                const selected = paymentMethod === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.paymentCard, selected && styles.paymentCardActive]}
                    onPress={() => setPaymentMethod(m.key)}
                    activeOpacity={0.88}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.paymentIconTile, selected && styles.paymentIconTileActive]}>
                      <Ionicons
                        name={m.icon}
                        size={20}
                        color={selected ? colors.paper.cream : colors.olive[800]}
                      />
                    </View>

                    <View style={styles.paymentInfo}>
                      <View style={styles.paymentHeaderRow}>
                        <Text style={styles.paymentTitle}>{m.label}</Text>
                        <View
                          style={[
                            styles.paymentBadge,
                            m.badgeType === "ochre"
                              ? styles.paymentBadgeOchre
                              : styles.paymentBadgeOlive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.paymentBadgeText,
                              m.badgeType === "ochre"
                                ? styles.paymentBadgeTextOchre
                                : styles.paymentBadgeTextOlive,
                            ]}
                          >
                            {m.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.paymentDesc}>{m.desc}</Text>

                      {m.brands.length > 0 && (
                        <View style={styles.brandRow}>
                          {m.brands.map((b) => (
                            <View key={b} style={styles.brandPill}>
                              <Text style={styles.brandPillText}>{b}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={[styles.shippingRadio, selected && styles.shippingRadioActive]}>
                      {selected && (
                        <Ionicons name="checkmark" size={13} color={colors.paper.cream} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

            <View style={styles.paymentReassurance}>
              <Ionicons
                name={paymentMethod === "cod" ? "shield-checkmark-outline" : "lock-closed-outline"}
                size={14}
                color={colors.olive[800]}
              />
              <Text style={styles.paymentReassuranceText}>
                {paymentMethod === "cod"
                  ? "Zero prepayment required. Inspect your items upon delivery before paying."
                  : paymentMethod === "stripe"
                    ? "You'll complete payment on Stripe's secure hosted page after placing the order."
                    : "Bank-grade 256-bit encryption. Payment processed through Payments.lk."}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => setStep(4)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Review order"
            >
              <Text style={styles.continueBtnText}>Review Order</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.panel}>
            <SectionHeader kicker="Step 04" title="Review & place" />

            <View style={styles.orderConfigCard}>
              <TouchableOpacity
                style={styles.orderConfigRow}
                onPress={() => setStep(1)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Change delivery address"
              >
                <View style={styles.orderConfigIcon}>
                  <Ionicons name="location-sharp" size={15} color={colors.olive[800]} />
                </View>
                <View style={styles.orderConfigInfo}>
                  <Text style={styles.orderConfigKicker}>DELIVER TO</Text>
                  <Text style={styles.orderConfigValue} numberOfLines={1}>
                    {addressSummary || "Select an address"}
                  </Text>
                </View>
                <View style={styles.orderConfigAction}>
                  <Text style={styles.orderConfigActionText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.olive[800]} />
                </View>
              </TouchableOpacity>

              <View style={styles.orderConfigDivider} />

              <TouchableOpacity
                style={styles.orderConfigRow}
                onPress={() => setStep(2)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Change shipping method"
              >
                <View style={styles.orderConfigIcon}>
                  <Ionicons name="cube-outline" size={15} color={colors.olive[800]} />
                </View>
                <View style={styles.orderConfigInfo}>
                  <Text style={styles.orderConfigKicker}>SHIPPING METHOD</Text>
                  <Text style={styles.orderConfigValue} numberOfLines={1}>
                    {shippingOption.label}
                    {deliveryDate ? ` · ${new Date(deliveryDate).toLocaleDateString("en-LK", { month: "short", day: "numeric" })}` : ""}
                  </Text>
                </View>
                <View style={styles.orderConfigAction}>
                  <Text style={styles.orderConfigActionText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.olive[800]} />
                </View>
              </TouchableOpacity>

              <View style={styles.orderConfigDivider} />

              <TouchableOpacity
                style={styles.orderConfigRow}
                onPress={() => setStep(3)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Change payment method"
              >
                <View style={styles.orderConfigIcon}>
                  <Ionicons
                    name={paymentMethod === "cod" ? "cash-outline" : "card-outline"}
                    size={15}
                    color={colors.olive[800]}
                  />
                </View>
                <View style={styles.orderConfigInfo}>
                  <Text style={styles.orderConfigKicker}>PAYMENT METHOD</Text>
                  <Text style={styles.orderConfigValue} numberOfLines={1}>
                    {paymentLabel}
                  </Text>
                </View>
                <View style={styles.orderConfigAction}>
                  <Text style={styles.orderConfigActionText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.olive[800]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.itemsSection}>
              <View style={styles.itemsSectionHead}>
                <View style={styles.itemsSectionTitleRow}>
                  <Ionicons name="bag-handle-outline" size={15} color={colors.olive[800]} />
                  <Text style={styles.itemsSectionLabel}>YOUR BAG</Text>
                </View>
                <View style={styles.itemsCountBadge}>
                  <Text style={styles.itemsCountText}>
                    {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
                  </Text>
                </View>
              </View>

              {cartItems.map((item, index) => (
                <View key={buildCartLineKeyFromItem(item)}>
                  {index > 0 && <View style={styles.itemDivider} />}
                  <View style={styles.reviewItem}>
                    <View style={styles.reviewThumb}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.reviewImage} contentFit="cover" />
                      ) : (
                        <View style={styles.reviewImagePlaceholder}>
                          <Ionicons name="bag-outline" size={20} color={colors.light.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>×{item.quantity}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewItemBody}>
                      <Text style={styles.reviewItemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.variantLabel ? (
                        <View style={styles.reviewVariantPill}>
                          <Text style={styles.reviewVariant}>{item.variantLabel}</Text>
                        </View>
                      ) : null}
                      <View style={styles.reviewItemPriceRow}>
                        <Text style={styles.reviewItemPrice}>
                          {formatPrice(item.price * item.quantity)}
                        </Text>
                        {item.quantity > 1 && (
                          <Text style={styles.reviewItemUnitPrice}>
                            ({formatPrice(item.price)} each)
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.couponCard}>
              <View style={styles.couponCardHead}>
                <View style={styles.couponIconWrap}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.olive[800]} />
                </View>
                <Text style={styles.couponCardTitle}>PROMO CODE</Text>
              </View>
              {couponCode && (couponDiscount > 0 || freeShippingCoupon) ? (
                <View style={styles.couponApplied}>
                  <View style={styles.couponAppliedLeft}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
                    <View>
                      <Text style={styles.couponAppliedCode}>{couponCode}</Text>
                      <Text style={styles.couponAppliedSub}>
                        {freeShippingCoupon ? "Free shipping applied" : `${formatPrice(couponDiscount)} discount`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={clearCoupon}
                    hitSlop={8}
                    style={styles.couponRemoveBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Remove promo code"
                  >
                    <Ionicons name="close" size={14} color={colors.light.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    value={couponInput}
                    onChangeText={setCouponInput}
                    placeholder="ENTER CODE"
                    placeholderTextColor={colors.light.mutedForeground}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.couponApplyBtn, !couponInput.trim() && styles.couponApplyBtnDisabled]}
                    onPress={applyCoupon}
                    disabled={!couponInput.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.couponApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <GiftCardBlock
              appliedCode={giftCardCode}
              appliedBalance={giftApplied}
              appliedCurrency={giftCardCurrency}
              onApply={async (code) => {
                const { validateGiftCardRedemption } = await import("@/lib/api");
                const res = await validateGiftCardRedemption({ code, order_currency: "LKR" });
                if (!res.ok) {
                  toast(res.error || "Card invalid", "error");
                  return;
                }
                if (!res.data.valid) {
                  toast(`Cannot apply: ${res.data.reason ?? "unknown"}`, "error");
                  return;
                }
                setGiftCardCode(code);
                setGiftCardBalance(res.data.current_balance ?? 0);
                setGiftCardCurrency(res.data.card_currency ?? "LKR");
                toast("Gift card applied", "success");
              }}
              onRemove={() => {
                setGiftCardCode(null);
                setGiftCardBalance(0);
              }}
            />

            <View style={styles.receiptCard}>
              <View style={styles.receiptHeaderRow}>
                <View style={styles.receiptIconWrap}>
                  <Ionicons name="receipt-outline" size={14} color={colors.olive[800]} />
                </View>
                <Text style={styles.receiptLabel}>PRICE BREAKDOWN</Text>
              </View>
              <View style={styles.receiptRule} />
              <SummaryLine label="Subtotal" value={formatPrice(sub - giftWrapFee)} />
              {giftWrapFee > 0 ? (
                <SummaryLine label="Gift wrap" value={formatPrice(giftWrapFee)} />
              ) : null}
              {couponDiscount > 0 && (
                <SummaryLine label="Coupon discount" value={`-${formatPrice(couponDiscount)}`} accent />
              )}
              {pointsValue > 0 && (
                <SummaryLine label="Loyalty points" value={`-${formatPrice(pointsValue)}`} accent />
              )}
              {giftApplied > 0 && (
                <SummaryLine label="Gift card" value={`-${formatPrice(giftApplied, giftCardCurrency)}`} accent />
              )}
              <SummaryLine
                label="Shipping"
                value={shippingFee === 0 ? "Complimentary" : formatPrice(shippingFee)}
                accent={shippingFee === 0}
              />
              <SummaryLine label="Tax · 8%" value={formatPrice(tax)} muted />
              <View style={styles.receiptRule} />
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>Total Payable</Text>
                  <Text style={styles.totalTaxNote}>Includes VAT & delivery</Text>
                </View>
                <Text style={styles.totalPrice}>{formatPrice(total)}</Text>
              </View>
            </View>

            {loyalty.state.points >= 100 && maxRedeemablePts >= 100 && (
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyIcon}>
                  <Ionicons name="diamond-outline" size={18} color={colors.olive[800]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loyaltyTitle}>Redeem loyalty points</Text>
                  <Text style={styles.loyaltySubtitle}>
                    {usePoints
                      ? `Redeeming ${pointsToUse.toLocaleString()} pts (-${formatPrice(pointsValue)})`
                      : `Up to ${maxRedeemablePts.toLocaleString()} pts available`}
                  </Text>
                </View>
                <Switch
                  value={usePoints}
                  onValueChange={setUsePoints}
                  trackColor={{ false: colors.light.border, true: colors.olive[600] }}
                  thumbColor={colors.paper.cream}
                />
              </View>
            )}

            <View style={styles.earnPill}>
              <Ionicons name="sparkles" size={13} color={colors.accent2.ochre} />
              <Text style={styles.earnPillText}>
                You will earn <Text style={styles.earnPillHighlight}>≈ {earnEstimate.toLocaleString()} pts</Text> on this order
              </Text>
            </View>

            <View style={styles.trustRow}>
              <TrustBadge icon="shield-checkmark-outline" label="Secure checkout" />
              <TrustBadge icon="swap-horizontal-outline" label="14-day returns" />
              <TrustBadge icon="leaf-outline" label="Atelier verified" />
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
              <Text style={styles.reviewFooterLabel}>TOTAL PAYABLE</Text>
              <Text style={styles.reviewFooterPrice}>{formatPrice(total)}</Text>
              <Text style={styles.reviewFooterSub}>All taxes & delivery included</Text>
            </View>
            <TouchableOpacity
              style={[styles.placeOrderBtn, loading && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Place order"
            >
              <Text style={styles.placeOrderText}>
                {loading ? "Placing order…" : "Place Order"}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {confirmingPayment && (
        <View style={styles.confirmOverlay}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Body muted>Confirming payment…</Body>
        </View>
      )}

      <AddressFormSheet
        visible={addressSheetOpen || !!editingAddress}
        initial={editingAddress}
        onClose={() => {
          setAddressSheetOpen(false);
          setEditingAddress(null);
        }}
        onSubmit={handleAddressSheetSubmit}
        title={editingAddress ? "Edit delivery address" : "Delivery address"}
        subtitle="Auto-detect location or drop a pin"
        primaryLabel={editingAddress ? "Save changes" : "Use this address"}
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
      <Text style={[styles.summaryLineLabel, muted && styles.summaryLineLabelMuted]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryLineValue,
          accent && styles.summaryLineValueAccent,
          muted && styles.summaryLineValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function TrustBadge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.trustBadge}>
      <Ionicons name={icon} size={12} color={colors.olive[800]} />
      <Text style={styles.trustLabel}>{label}</Text>
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
          <View style={styles.couponIconWrap}>
            <Ionicons name="gift-outline" size={14} color={colors.olive[800]} />
          </View>
          <Text style={styles.couponCardTitle}>GIFT CARD</Text>
        </View>
        <View style={styles.couponApplied}>
          <View style={styles.couponAppliedLeft}>
            <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
            <View>
              <Text style={styles.couponAppliedCode}>{appliedCode}</Text>
              <Text style={styles.couponAppliedSub}>
                {formatPrice(appliedBalance, appliedCurrency)} applied at checkout
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={8}
            style={styles.couponRemoveBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove gift card"
          >
            <Ionicons name="close" size={14} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.couponCard}>
      <View style={styles.couponCardHead}>
        <View style={styles.couponIconWrap}>
          <Ionicons name="gift-outline" size={14} color={colors.olive[800]} />
        </View>
        <Text style={styles.couponCardTitle}>GIFT CARD</Text>
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
        <TouchableOpacity
          style={[styles.couponApplyBtn, (busy || code.trim().length < 4) && styles.couponApplyBtnDisabled]}
          onPress={async () => {
            const trimmed = code.trim();
            if (trimmed.length < 4) return;
            setBusy(true);
            await onApply(trimmed);
            setBusy(false);
          }}
          disabled={busy || code.trim().length < 4}
          activeOpacity={0.85}
        >
          <Text style={styles.couponApplyText}>{busy ? "…" : "Apply"}</Text>
        </TouchableOpacity>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  stepItem: {
    alignItems: "center",
    gap: 5,
    width: 62,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 4,
  },
  stepCircleDone: {
    backgroundColor: colors.olive[700],
    borderColor: colors.olive[700],
  },
  stepNum: {
    fontFamily: fontFamilies.mono.medium,
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  stepNumActive: {
    fontFamily: fontFamilies.mono.semibold,
    color: colors.paper.cream,
    fontSize: 12,
  },
  stepLabel: {
    fontFamily: fontFamilies.mono.medium,
    color: colors.light.mutedForeground,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  stepLabelActive: {
    fontFamily: fontFamilies.mono.semibold,
    color: colors.olive[800],
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  stepLineWrap: {
    flex: 1,
    height: 32,
    justifyContent: "center",
    marginHorizontal: -4,
  },
  stepLine: {
    height: 2,
    backgroundColor: colors.light.border,
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: colors.olive[700],
  },
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
    marginHorizontal: 20,
    marginBottom: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  contextIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  contextText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.foreground,
  },
  contextPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  content: { paddingHorizontal: 20 },
  panel: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[5],
    gap: spacing[3.5],
    ...shadows.soft,
  },
  addressCard: {
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    gap: 10,
  },
  addressCardActive: {
    borderColor: colors.olive[700],
    borderWidth: 1.5,
    backgroundColor: "rgba(83,94,44,0.03)",
    ...shadows.soft,
  },
  addressCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  addressTypeTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  addressTypeTileActive: {
    backgroundColor: colors.olive[800],
  },
  addressHeadInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  addressName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typeBadge: {
    backgroundColor: colors.olive[100],
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.sm,
  },
  typeBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.olive[800],
    letterSpacing: 0.6,
  },
  defaultBadge: {
    backgroundColor: "rgba(200,164,74,0.18)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.sm,
  },
  defaultBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#8a6a2a",
    letterSpacing: 0.6,
  },
  addressRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  addressRadioActive: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  addressText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.light.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  phoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  pinnedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pinnedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.olive[700],
  },
  pinnedText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.olive[800],
    letterSpacing: 0.2,
  },
  addressCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
    marginTop: 2,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  selectedTagText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  tapToSelectText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.olive[50],
  },
  editBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },
  addAddressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.3)",
    backgroundColor: colors.paper.cream,
  },
  addAddressIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  addAddressCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addAddressTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  addAddressSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  addAddressChevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtn: {
    minHeight: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
  },
  continueBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.paper.cream,
    letterSpacing: 0.3,
  },
  guestEmailCard: {
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  guestEmailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  guestEmailLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 0.8,
  },
  guestEmailInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
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
  deliverToCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.warm,
    gap: spacing[2],
  },
  deliverToLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flex: 1,
    minWidth: 0,
  },
  deliverToIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  deliverToInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  deliverToKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  deliverToAddress: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  deliverToChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  deliverToChangeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },

  shippingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3] + 2,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  shippingCardActive: {
    borderColor: colors.olive[700],
    backgroundColor: colors.olive[50],
    shadowColor: colors.olive[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  shippingIconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  shippingIconTileActive: {
    backgroundColor: colors.olive[800],
  },
  shippingInfo: {
    flex: 1,
    minWidth: 0,
  },
  shippingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shippingTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  fastestBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.ochre + "25",
  },
  fastestBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: colors.accent2.ochre,
    letterSpacing: 0.5,
  },
  shippingDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  shippingArrivalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  shippingArrivalPillActive: {
    backgroundColor: colors.paper.cream,
    borderColor: colors.olive[300],
  },
  shippingArrivalText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 0.2,
  },
  shippingArrivalTextActive: {
    color: colors.olive[900],
    fontFamily: fontFamilies.mono.semibold,
  },
  shippingRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  shippingFreeBadge: {
    backgroundColor: "#EBF6EC",
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "#B8E3BB",
  },
  shippingFreeBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#227226",
    letterSpacing: 0.4,
  },
  shippingFeeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  shippingRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shippingRadioActive: {
    borderColor: colors.olive[800],
    backgroundColor: colors.olive[800],
  },

  shippingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2] + 2,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: "#FFFDF5",
    borderWidth: 1,
    borderColor: "#F0E4B8",
  },
  shippingBannerUnlocked: {
    backgroundColor: "#F3F7F2",
    borderColor: "#CDE3CB",
  },
  shippingBannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEF7DC",
    alignItems: "center",
    justifyContent: "center",
  },
  shippingBannerIconUnlocked: {
    backgroundColor: colors.olive[100],
  },
  shippingBannerText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
  shippingBannerHighlight: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[900],
  },
  shippingBannerTextUnlocked: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[800],
    lineHeight: 16,
  },

  deliveryDateSection: {
    marginTop: 2,
    marginBottom: spacing[2],
  },
  dateScrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  dateChipNew: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    minWidth: 84,
  },
  dateChipNewActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  dateChipKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.light.mutedForeground,
  },
  dateChipKickerActive: {
    color: colors.paper.cream,
    opacity: 0.8,
  },
  dateChipMain: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  dateChipMainActive: {
    color: colors.paper.cream,
  },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3] + 3,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  paymentCardActive: {
    borderColor: colors.olive[700],
    backgroundColor: colors.olive[50],
    shadowColor: colors.olive[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentIconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIconTileActive: {
    backgroundColor: colors.olive[800],
  },
  paymentInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  paymentTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.full,
  },
  paymentBadgeOlive: {
    backgroundColor: colors.olive[100],
  },
  paymentBadgeOchre: {
    backgroundColor: colors.accent2.ochre + "20",
  },
  paymentBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  paymentBadgeTextOlive: {
    color: colors.olive[800],
  },
  paymentBadgeTextOchre: {
    color: colors.accent2.ochre,
  },
  paymentDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  brandPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.warm,
  },
  brandPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: colors.light.foreground,
    letterSpacing: 0.3,
  },
  paymentReassurance: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2] + 2,
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.olive[50] + "80",
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  paymentReassuranceText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.olive[900],
    lineHeight: 16,
  },
  codNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2.5],
    padding: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#F4C9B8",
    backgroundColor: "#FDF5F2",
  },
  codNoticeIconWrap: {
    marginTop: 1,
  },
  codNoticeCopy: {
    flex: 1,
    gap: 2,
  },
  codNoticeTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.accent2.rust,
  },
  codNoticeDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.accent2.rust,
    lineHeight: 15,
  },

  orderConfigCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    overflow: "hidden",
  },
  orderConfigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
  },
  orderConfigIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  orderConfigInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  orderConfigKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  orderConfigValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  orderConfigAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  orderConfigActionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  orderConfigDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginLeft: 48,
  },

  itemsSection: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[3] + 2,
    gap: spacing[3],
  },
  itemsSectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemsSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemsSectionLabel: {
    color: colors.olive[800],
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  itemsCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  itemsCountText: {
    color: colors.olive[900],
    fontSize: 10,
    fontFamily: fontFamilies.sans.semibold,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.paper.warm,
    marginVertical: 4,
  },
  reviewItem: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "center",
  },
  reviewThumb: {
    width: 68,
    height: 80,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
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
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadgeText: {
    color: colors.paper.cream,
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
  },
  reviewItemBody: {
    flex: 1,
    gap: 3,
  },
  reviewItemName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.light.foreground,
    lineHeight: 18,
  },
  reviewVariantPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  reviewVariant: {
    color: colors.olive[800],
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.3,
  },
  reviewItemPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  reviewItemPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  reviewItemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },

  couponCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[3] + 2,
    gap: spacing[2.5],
  },
  couponCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  couponIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  couponCardTitle: {
    color: colors.olive[800],
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
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
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.warm,
    paddingHorizontal: spacing[3] + 2,
    fontSize: 13,
    fontFamily: fontFamilies.mono.medium,
    color: colors.light.foreground,
    letterSpacing: 0.8,
  },
  couponApplyBtn: {
    height: 44,
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplyBtnDisabled: {
    opacity: 0.45,
  },
  couponApplyText: {
    color: colors.paper.cream,
    fontSize: 12,
    fontFamily: fontFamilies.sans.bold,
    letterSpacing: 0.4,
  },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: "#F3F8F2",
    borderWidth: 1,
    borderColor: "#C8E2C6",
  },
  couponAppliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2] + 2,
    flex: 1,
  },
  couponAppliedCode: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[900],
  },
  couponAppliedSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#237804",
  },
  couponRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  receiptCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[3] + 2,
    gap: spacing[2],
  },
  receiptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  receiptIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  receiptLabel: {
    color: colors.olive[800],
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  receiptRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: spacing[1],
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2.5,
  },
  summaryLineLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.foreground,
  },
  summaryLineLabelMuted: {
    color: colors.light.mutedForeground,
  },
  summaryLineValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  summaryLineValueAccent: {
    color: "#237804",
  },
  summaryLineValueMuted: {
    color: colors.light.mutedForeground,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing[1],
  },
  totalLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  totalTaxNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  totalPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 19,
    color: colors.olive[900],
  },

  loyaltyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3] + 2,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.olive[200],
    backgroundColor: colors.olive[50],
  },
  loyaltyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  loyaltyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  loyaltySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },

  earnPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: "#FFFDF5",
    borderWidth: 1,
    borderColor: "#F0E4B8",
  },
  earnPillText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  earnPillHighlight: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[900],
  },

  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  trustLabel: {
    color: colors.olive[800],
    fontSize: 10,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.2,
  },

  reviewFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3] + 2,
    backgroundColor: colors.light.card,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    ...shadows.editorial,
  },
  reviewFooterTotal: {
    flex: 1,
    gap: 1,
  },
  reviewFooterLabel: {
    color: colors.olive[700],
    fontSize: 9,
    letterSpacing: 0.8,
    fontFamily: fontFamilies.mono.semibold,
    textTransform: "uppercase",
  },
  reviewFooterPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    color: colors.light.foreground,
  },
  reviewFooterSub: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
  },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  placeOrderText: {
    color: colors.paper.cream,
    fontSize: 14,
    letterSpacing: 0.3,
    fontFamily: fontFamilies.sans.bold,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    zIndex: 20,
  },
});
