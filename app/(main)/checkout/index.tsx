import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader } from "@/components/layout";
import {
  AddressFormSheet,
  type AddressFormPayload,
} from "@/components/address/AddressFormSheet";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { useQueryClient } from "@tanstack/react-query";
import { useCheckoutPricing, CHECKOUT_PRICING_QUERY_KEY } from "@/lib/hooks/useCheckoutPricing";
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
import { computeCartTotals, computeOrderShipping, platformFeeFor, shippingFeeFor } from "@/lib/cart-pricing";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";
import { useTrackCheckoutStarted } from "@/lib/recommender";
import {
  OrderPlacingOverlay,
  ORDER_OVERLAY_MIN_PLACING_MS,
  ORDER_OVERLAY_SUCCESS_HOLD_MS,
  type OrderOverlayPhase,
} from "@/components/checkout/OrderPlacingOverlay";

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
  const pricing = useCheckoutPricing();
  const queryClient = useQueryClient();
  const loyalty = useLoyalty();
  const { items, subtotal, couponCode, setCoupon, clear, addItem } = useCart();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  // Full-screen placing → success animation (see OrderPlacingOverlay).
  const [overlayPhase, setOverlayPhase] = useState<OrderOverlayPhase>("idle");
  const [overlayOrigin, setOverlayOrigin] = useState<{ x: number; y: number } | null>(null);
  const [overlayOrderNumber, setOverlayOrderNumber] = useState<string | null>(null);
  // Snapshot at tap time — the bag is cleared before the success beat plays.
  const [overlaySnapshot, setOverlaySnapshot] = useState({ thumbnails: [] as string[], storeCount: 1, total: "" });
  const placingStartedAt = useRef(0);
  const placeOrderBtnRef = useRef<View>(null);
  const pendingLoyaltyPointsRef = useRef(0);
  /** Synchronous re-entrancy guard for handlePlaceOrder — set before any
   *  `await` so a second tap during the pre-`setLoading` validation phase
   *  (address/cart checks, reservation hold) is a no-op instead of racing
   *  the first tap into placing a duplicate order. */
  const isSubmittingRef = useRef(false);
  /** Set right before the bag is cleared after a placed (or abandoned) order,
   *  so the empty-bag guard below doesn't hijack the success navigation. */
  const checkoutFinishedRef = useRef(false);
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
        pricing,
      }),
    [pricingLines, shippingKey, couponDiscount, pointsToUse, freeShippingCoupon, giftCardBalance, cartItems, pricing],
  );
  const sub = checkoutTotals.sub;
  const shippingFee = checkoutTotals.shipping;
  const afterCoupon = checkoutTotals.afterCoupon;
  const pointsValue = pointsToUse;
  const tax = checkoutTotals.tax;
  const total = checkoutTotals.total;
  const giftApplied = checkoutTotals.giftApplied;

  // Fire checkout_started once when the user reaches the address step with a
  // non-empty bag. Mirrors web's behaviour.
  useTrackCheckoutStarted(sub, cartItems.length);

  // Some bag lines were added without an image (e.g. from rails that don't
  // carry one) — backfill thumbnails from the product snapshot.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const missingThumbIds = [
    ...new Set(cartItems.filter((i) => !i.image).map((i) => i.productId)),
  ].join(",");
  useEffect(() => {
    if (!missingThumbIds) return;
    let cancelled = false;
    const ids = missingThumbIds.split(",");
    void fetchCartProductSnapshots(ids).then((res) => {
      if (cancelled || !res.ok) return;
      const next: Record<string, string> = {};
      for (const id of ids) {
        const imgs = res.products[id]?.images;
        const url = imgs?.find((im) => im.is_primary)?.url || imgs?.[0]?.url;
        if (url) next[id] = url;
      }
      if (Object.keys(next).length) setThumbs((t) => ({ ...t, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [missingThumbIds]);
  const earnEstimate = Math.floor(afterCoupon * 0.05);
  // Max redeemable points: capped at balance and post-coupon subtotal (100-pt blocks).
  const maxRedeemablePts =
    Math.floor(Math.min(loyalty.state.points, Math.floor(Math.max(0, sub - couponDiscount))) / 100) * 100;
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.key === shippingKey) ?? SHIPPING_OPTIONS[0];

  useEffect(() => {
    if (checkoutFinishedRef.current) return;
    if (authLoading) return;
    // Orders always belong to an account; guest checkout is not offered on mobile.
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      const prepared = await isCheckoutPrepared();
      if (cancelled || checkoutFinishedRef.current) return;
      if (!prepared || Object.keys(items).length === 0) {
        toast("Select items in your bag before checkout", "info");
        router.replace("/(main)/cart");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, items, router, toast]);

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

  // (main) is a Tabs navigator, so this screen stays mounted after an order
  // completes. When the buyer starts a new checkout, reset to a fresh flow and
  // re-run the bag guard the finished flag suppressed while we were blurred.
  useFocusEffect(
    useCallback(() => {
      if (!checkoutFinishedRef.current) return;
      checkoutFinishedRef.current = false;
      setOverlayPhase("idle");
      setStep(1);
      void isCheckoutPrepared().then((prepared) => {
        if (!prepared || Object.keys(useCart.getState().items).length === 0) {
          router.replace("/(main)/cart");
        }
      });
    }, [router]),
  );

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

  /** Hold the placing stage for its minimum, then play the success beat. */
  const celebrateOrder = async (orderNumber: string | null) => {
    const wait = ORDER_OVERLAY_MIN_PLACING_MS - (Date.now() - placingStartedAt.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setOverlayOrderNumber(orderNumber);
    setOverlayPhase("success");
    await new Promise((r) => setTimeout(r, ORDER_OVERLAY_SUCCESS_HOLD_MS));
  };
  // (main) is a Tabs navigator, so this screen stays mounted behind the
  // success screen — drop the overlay once we've navigated away.
  const dismissOverlaySoon = () => setTimeout(() => setOverlayPhase("idle"), 450);

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

    placingStartedAt.current = Date.now();
    setOverlaySnapshot({
      thumbnails: cartItems
        .map((item) => item.image || thumbs[item.productId])
        .filter((u): u is string => !!u),
      storeCount: new Set(cartItems.map((item) => item.storeId)).size || 1,
      total: formatPrice(total),
    });
    setOverlayOrderNumber(null);
    setOverlayPhase("placing");

    const checkoutValidation = await validateCartForCheckout();
    if (!checkoutValidation.ok) {
      setOverlayPhase("idle");
      toast(checkoutValidation.error, "error");
      router.replace("/(main)/cart");
      return;
    }

    const freshCartItems = Object.values(useCart.getState().items);
    if (freshCartItems.length === 0) {
      setOverlayPhase("idle");
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
        setOverlayPhase("idle");
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
          pricing,
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
        // Each store pays its own delivery fee; the platform fee is charged
        // on the store's discounted subtotal. The backend re-prices both.
        const shippingFee = freeShippingCoupon ? 0 : shippingFeeFor(shippingKey, pricing);
        const discount = Math.min(g.totals.sub, round2((couponDiscount + freshPointsToUse) * share));
        const tax = round2(platformFeeFor(g.totals.sub - discount, pricing));
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
        // Fees may have been changed by an admin mid-checkout — refresh them.
        void queryClient.invalidateQueries({ queryKey: CHECKOUT_PRICING_QUERY_KEY });
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
          setOverlayPhase("idle");
          const result = await runPaymentsLkCheckout(session.data.url);
          await releaseCartReservations();
          reservationsHeld = false;
          checkoutFinishedRef.current = true;
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
        const celebrated = celebrateOrder(null);
        await releaseCartReservations();
        reservationsHeld = false;
        checkoutFinishedRef.current = true;
        clear();
        await celebrated;
        router.replace(
          `/(main)/orders/guest-lookup?token=${encodeURIComponent(token ?? "")}&email=${encodeURIComponent(guestEmail.trim())}` as never,
        );
        dismissOverlaySoon();
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
      const firstNumber = subOrders[0].order_number ?? null;
      const overlayNumber =
        firstNumber && subOrders.length > 1 ? `${firstNumber} +${subOrders.length - 1}` : firstNumber;

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
        const celebrated = celebrateOrder(overlayNumber);
        await releaseCartReservations();
        reservationsHeld = false;
        checkoutFinishedRef.current = true;
        clear();
        await loyalty.reload();
        await celebrated;
        const orderIdsParam = allIds.length > 0 ? allIds.join(",") : firstOrderId;
        router.replace(
          `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIdsParam)}` as never,
        );
        dismissOverlaySoon();
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
          checkoutFinishedRef.current = true;
          clear();
          toast(
            `Payment cancelled — ${siblingIds.length} other order${siblingIds.length === 1 ? "" : "s"} kept for cash on delivery`,
            "info",
          );
        } else {
          checkoutFinishedRef.current = true;
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

        setOverlayPhase("idle");
        const result = await runPaymentsLkCheckout(session.data.url);
        if (result.status === "succeeded") {
          setOverlayPhase("confirming");
          const poll = await pollOrderPaymentStatus(firstOrderId);
          if (!poll.ok) {
            setOverlayPhase("idle");
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
        setOverlayPhase("idle");
        await WebBrowser.openBrowserAsync(session.data.url);
        setOverlayPhase("confirming");
        const poll = await pollOrderPaymentStatus(firstOrderId, {
          maxAttempts: 25,
          intervalMs: 3000,
        });
        if (poll.ok) {
          await finalizePaidCheckout();
          return;
        }
        setOverlayPhase("idle");
        await abandonCardCheckout(true);
        return;
      }

      // Let the success beat play while the bag is cleaned up underneath.
      const celebrated = celebrateOrder(overlayNumber);
      if (freshPointsToUse > 0) {
        await loyalty.redeem(freshPointsToUse, firstOrderId);
      }
      await loyalty.reload();
      await releaseCartReservations();
      reservationsHeld = false;
      checkoutFinishedRef.current = true;
      clear();
      await celebrated;
      const orderIds = placed.map((o) => o.id).join(",");
      router.replace(
        `/(main)/checkout/success?orderIds=${encodeURIComponent(orderIds)}` as never,
      );
      dismissOverlaySoon();
    } catch (e: any) {
      setOverlayPhase("idle");
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
        <View style={styles.stepHeadRow}>
          <Text style={styles.stepKicker}>
            Step {step} of {STEPS.length}
          </Text>
          <Text style={styles.stepCurrent}>{STEPS[step - 1]?.label}</Text>
        </View>
        <View style={styles.stepTrack}>
          {STEPS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={styles.stepItem}
              disabled={s.key >= step}
              onPress={() => setStep(s.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${s.label} step`}
            >
              <View style={[styles.stepLine, step >= s.key && styles.stepLineActive]} />
              <View style={styles.stepLabelRow}>
                {step > s.key ? (
                  <Ionicons name="checkmark-circle" size={11} color={colors.olive[700]} />
                ) : null}
                <Text
                  style={
                    step === s.key
                      ? styles.stepLabelActive
                      : step > s.key
                        ? styles.stepLabelDone
                        : styles.stepLabel
                  }
                >
                  {s.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.contextStrip}>
        <View style={styles.contextThumbs}>
          {cartItems.slice(0, 3).map((it, i) => {
            const img = it.image || thumbs[it.productId];
            return (
              <View
                key={buildCartLineKeyFromItem(it)}
                style={[styles.contextThumb, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
              >
                {img ? (
                  <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Ionicons name="bag-handle-outline" size={13} color={colors.olive[800]} />
                )}
              </View>
            );
          })}
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
            { paddingBottom: insets.bottom + 128 },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {step === 1 && (
          <View style={styles.panel}>
            <StepTitle kicker="Delivery" title="Where should we deliver?" subtitle="Choose a saved address or add a new one." />
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
                <Ionicons name="add" size={20} color={colors.paper.cream} />
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
          </View>
        )}

        {step === 2 && (
          <View style={styles.panel}>
            <StepTitle kicker="Shipping" title="How fast do you want it?" subtitle="Arrival dates are estimates from today." />

            <View style={styles.deliverToCard}>
              <View style={styles.deliverToLeft}>
                <View style={styles.deliverToIcon}>
                  <Ionicons name="location-sharp" size={16} color={colors.accent2.ochre} />
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
                pricing,
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
              const storeCount = new Set(pricingLines.map((l) => l.storeId)).size;
              return (
                <View style={styles.shippingBanner}>
                  <View style={styles.shippingBannerIcon}>
                    <Ionicons name="cube-outline" size={13} color={colors.accent2.ochre} />
                  </View>
                  <Text style={styles.shippingBannerText}>
                    Delivery is charged per store
                    {storeCount > 1 ? <> — your bag ships from <Text style={styles.shippingBannerHighlight}>{storeCount} stores</Text></> : null}.
                  </Text>
                </View>
              );
            })()}

            <View style={styles.deliveryDateSection}>
              <StepTitle kicker="Optional" title="Preferred delivery date" small />
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
          </View>
        )}

        {step === 3 && (
          <View style={styles.panel}>
            <StepTitle kicker="Payment" title="How will you pay?" subtitle="Pay at your door, or securely by card." />

            <View style={styles.deliverToCard}>
              <View style={styles.deliverToLeft}>
                <View style={styles.deliverToIcon}>
                  <Ionicons name="cube-outline" size={16} color={colors.accent2.ochre} />
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
              // Cash on delivery is the only payment method offered for now.
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
                            styles.paymentBadgeOlive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.paymentBadgeText,
                              styles.paymentBadgeTextOlive,
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
          </View>
        )}

        {step === 4 && (
          <View style={styles.panel}>
            <StepTitle kicker="Review" title="Almost there" subtitle="Check everything before you place your order." />

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
                  <Text style={styles.itemsSectionLabel}>Your bag</Text>
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
                      {item.image || thumbs[item.productId] ? (
                        <Image
                          source={{ uri: item.image || thumbs[item.productId] }}
                          style={styles.reviewImage}
                          contentFit="cover"
                        />
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
                <Text style={styles.couponCardTitle}>Promo code</Text>
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
                <Text style={styles.receiptLabel}>Price breakdown</Text>
              </View>
              <View style={styles.receiptRule} />
              <SummaryLine label="Subtotal" value={formatPrice(sub)} />
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
              <SummaryLine label={`Platform fee · ${pricing.platform_fee_pct}%`} value={formatPrice(tax)} muted />
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

        <View
          style={[styles.reviewFooter, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
          pointerEvents="box-none"
        >
          <View style={styles.reviewFooterTotal}>
            <Text style={styles.reviewFooterLabel}>{step === 4 ? "Total payable" : "Order total"}</Text>
            <Text style={styles.reviewFooterPrice}>{formatPrice(total)}</Text>
            <Text style={styles.reviewFooterSub}>
              {step === 4
                ? "Platform fee & delivery included"
                : `${cartItems.length} item${cartItems.length === 1 ? "" : "s"} · ${shippingFee === 0 ? "free delivery" : `${formatPrice(shippingFee)} delivery`}`}
            </Text>
          </View>
          <TouchableOpacity
            ref={placeOrderBtnRef}
            style={[styles.placeOrderBtn, loading && { opacity: 0.7 }]}
            onPress={
              step === 1
                ? handleAddressContinue
                : step === 2
                  ? () => setStep(3)
                  : step === 3
                    ? () => setStep(4)
                    : () => {
                        // The glow rises from the button the buyer pressed.
                        placeOrderBtnRef.current?.measureInWindow((x, y, w, h) =>
                          setOverlayOrigin({ x: x + w / 2, y: y + h / 2 }),
                        );
                        void handlePlaceOrder();
                      }
            }
            disabled={loading}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={step === 4 ? "Place order" : "Continue"}
          >
            {loading ? <ActivityIndicator size="small" color={colors.paper.cream} /> : null}
            <Text style={styles.placeOrderText}>
              {step === 4 ? (loading ? "Placing…" : "Place order") : step === 3 ? "Review order" : "Continue"}
            </Text>
            {!loading ? (
              <Ionicons
                name={step === 4 ? "lock-closed" : "arrow-forward"}
                size={step === 4 ? 14 : 16}
                color={colors.paper.cream}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <OrderPlacingOverlay
        phase={overlayPhase}
        origin={overlayOrigin}
        total={overlaySnapshot.total}
        orderNumber={overlayOrderNumber}
        thumbnails={overlaySnapshot.thumbnails}
        storeCount={overlaySnapshot.storeCount}
      />

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

function StepTitle({
  kicker,
  title,
  subtitle,
  small,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  small?: boolean;
}) {
  return (
    <View style={[styles.stepTitleWrap, small && styles.stepTitleWrapSmall]}>
      <Text style={styles.stepTitleKicker}>{kicker}</Text>
      <Text style={[styles.stepTitle, small && styles.stepTitleSmall]}>{title}</Text>
      {subtitle ? <Text style={styles.stepTitleSub}>{subtitle}</Text> : null}
    </View>
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
          <Text style={styles.couponCardTitle}>Gift card</Text>
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
        <Text style={styles.couponCardTitle}>Gift card</Text>
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

const INK = colors.olive[900];
const CREAM = colors.paper.cream;
const SURFACE = "#ffffff";
const PAGE = colors.paper.DEFAULT;
const HAIR = `${colors.light.border}b3`;

/** Shared white option-card surface. */
const surfaceCard = {
  backgroundColor: SURFACE,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: HAIR,
  shadowColor: colors.ink.DEFAULT,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 10,
  elevation: 1,
} as const;

const selectedCard = {
  borderColor: INK,
  borderWidth: 1.5,
  shadowOpacity: 0.1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
} as const;

const kickerText = {
  fontFamily: fontFamilies.mono.medium,
  fontSize: 9.5,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  color: colors.light.mutedForeground,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[5],
  },

  /* ---- Stepper ---- */
  stepBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  stepHeadRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 10,
  },
  stepKicker: {
    ...kickerText,
    color: colors.olive[600],
  },
  stepCurrent: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  stepTrack: {
    flexDirection: "row",
    gap: 6,
  },
  stepItem: {
    flex: 1,
    gap: 7,
  },
  stepLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.muted,
  },
  stepLineActive: {
    backgroundColor: INK,
  },
  stepLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stepLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  stepLabelDone: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.olive[700],
  },
  stepLabelActive: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11.5,
    color: colors.light.foreground,
  },

  /* ---- Bag strip ---- */
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIR,
  },
  contextThumbs: {
    flexDirection: "row",
  },
  contextThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    borderWidth: 2,
    borderColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  contextIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  contextText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  contextPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },

  content: { paddingHorizontal: 20, paddingTop: 10 },
  panel: {
    gap: 12,
  },

  /* ---- Step titles ---- */
  stepTitleWrap: {
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
  },
  stepTitleWrapSmall: {
    paddingTop: 18,
    paddingBottom: 2,
  },
  stepTitleKicker: {
    ...kickerText,
    color: colors.olive[600],
  },
  stepTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.light.foreground,
  },
  stepTitleSmall: {
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  stepTitleSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.light.mutedForeground,
  },

  /* ---- Address ---- */
  addressCard: {
    ...surfaceCard,
    padding: 16,
    gap: 10,
  },
  addressCardActive: {
    ...selectedCard,
  },
  addressCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  addressLeftCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressTypeTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  addressTypeTileActive: {
    backgroundColor: INK,
  },
  addressHeadInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  addressName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: colors.light.foreground,
    maxWidth: "60%",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 5,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.olive[50],
  },
  typeBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.olive[700],
  },
  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${colors.accent2.ochre}22`,
  },
  defaultBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#8a6d22",
  },
  addressRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addressRadioActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  addressText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink.soft,
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
    gap: 5,
  },
  phoneText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  pinnedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  pinnedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.olive[500],
  },
  pinnedText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[700],
  },
  addressCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  selectedTagText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.olive[700],
  },
  tapToSelectText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: PAGE,
  },
  editBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.olive[800],
  },
  addAddressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.olive[300],
    backgroundColor: `${colors.olive[50]}80`,
  },
  addAddressIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  addAddressCopy: {
    flex: 1,
    gap: 2,
  },
  addAddressTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  addAddressSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  addAddressChevronWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  guestEmailCard: {
    ...surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  guestEmailIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  guestEmailLabel: {
    ...kickerText,
  },
  guestEmailInput: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
    paddingVertical: 2,
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
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.4,
  },

  /* ---- Context card (deliver-to / shipping-via) ---- */
  deliverToCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    paddingLeft: 14,
    borderRadius: 18,
    backgroundColor: INK,
  },
  deliverToLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deliverToIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deliverToInfo: {
    flex: 1,
    gap: 2,
  },
  deliverToKicker: {
    ...kickerText,
    color: "rgba(250,248,241,0.6)",
  },
  deliverToAddress: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: CREAM,
  },
  deliverToChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: CREAM,
  },
  deliverToChangeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: INK,
  },

  /* ---- Shipping ---- */
  shippingCard: {
    ...surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  shippingCardActive: {
    ...selectedCard,
  },
  shippingIconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  shippingIconTileActive: {
    backgroundColor: INK,
  },
  shippingInfo: {
    flex: 1,
    gap: 3,
  },
  shippingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  shippingTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    color: colors.light.foreground,
  },
  fastestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: `${colors.accent2.ochre}22`,
  },
  fastestBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1,
    color: "#8a6d22",
  },
  shippingDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  shippingArrivalPill: {
    marginTop: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shippingArrivalPillActive: {},
  shippingArrivalText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[700],
  },
  shippingArrivalTextActive: {
    color: INK,
  },
  shippingRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  shippingFreeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: colors.olive[100],
  },
  shippingFreeBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.olive[800],
  },
  shippingFeeText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  shippingRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  shippingRadioActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  shippingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f6efdc",
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}44`,
  },
  shippingBannerUnlocked: {
    backgroundColor: colors.olive[50],
    borderColor: colors.olive[100],
  },
  shippingBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  shippingBannerIconUnlocked: {
    backgroundColor: SURFACE,
  },
  shippingBannerText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink.soft,
  },
  shippingBannerHighlight: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },
  shippingBannerTextUnlocked: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.olive[800],
  },
  deliveryDateSection: {
    gap: 12,
  },
  dateScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  dateChipNew: {
    ...surfaceCard,
    width: 76,
    height: 76,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dateChipNewActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  dateChipKicker: {
    ...kickerText,
    fontSize: 9,
  },
  dateChipKickerActive: {
    color: colors.accent2.ochre,
  },
  dateChipMain: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  dateChipMainActive: {
    color: CREAM,
  },

  /* ---- Payment ---- */
  paymentCard: {
    ...surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  paymentCardActive: {
    ...selectedCard,
  },
  paymentIconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIconTileActive: {
    backgroundColor: INK,
  },
  paymentInfo: {
    flex: 1,
    gap: 3,
  },
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  paymentTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    color: colors.light.foreground,
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  paymentBadgeOlive: {
    backgroundColor: colors.olive[100],
  },
  paymentBadgeOchre: {
    backgroundColor: `${colors.accent2.ochre}22`,
  },
  paymentBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1,
  },
  paymentBadgeTextOlive: {
    color: colors.olive[800],
  },
  paymentBadgeTextOchre: {
    color: "#8a6d22",
  },
  paymentDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  brandRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
  },
  brandPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: PAGE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  brandPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.6,
    color: colors.ink.soft,
  },
  paymentReassurance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
  },
  paymentReassuranceText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.olive[800],
  },
  codNotice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: `${colors.accent2.rust}10`,
    borderWidth: 1,
    borderColor: `${colors.accent2.rust}30`,
  },
  codNoticeIconWrap: {
    paddingTop: 1,
  },
  codNoticeCopy: {
    flex: 1,
    gap: 2,
  },
  codNoticeTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.accent2.rust,
  },
  codNoticeDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink.soft,
  },

  /* ---- Review ---- */
  orderConfigCard: {
    ...surfaceCard,
    paddingVertical: 4,
  },
  orderConfigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orderConfigIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  orderConfigInfo: {
    flex: 1,
    gap: 2,
  },
  orderConfigKicker: {
    ...kickerText,
  },
  orderConfigValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    color: colors.light.foreground,
  },
  orderConfigAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: PAGE,
  },
  orderConfigActionText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.olive[800],
  },
  orderConfigDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginLeft: 64,
  },
  itemsSection: {
    ...surfaceCard,
    padding: 16,
  },
  itemsSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemsSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  itemsSectionLabel: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 19,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  itemsCountBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: PAGE,
  },
  itemsCountText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: 12,
  },
  reviewItem: {
    flexDirection: "row",
    gap: 14,
  },
  reviewThumb: {
    width: 72,
    height: 90,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#efede4",
  },
  reviewImage: {
    width: "100%",
    height: "100%",
  },
  reviewImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 7,
    backgroundColor: INK,
  },
  qtyBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: CREAM,
  },
  reviewItemBody: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  reviewItemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.light.foreground,
  },
  reviewVariantPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: PAGE,
  },
  reviewVariant: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.ink.soft,
  },
  reviewItemPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 2,
  },
  reviewItemPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  reviewItemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  couponCard: {
    ...surfaceCard,
    padding: 14,
    gap: 12,
  },
  couponCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  couponIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  couponCardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  couponInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 5,
    paddingLeft: 14,
    borderRadius: 14,
    backgroundColor: PAGE,
  },
  couponInput: {
    flex: 1,
    height: 40,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.light.foreground,
  },
  couponApplyBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 11,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  couponApplyBtnDisabled: {
    backgroundColor: colors.light.border,
  },
  couponApplyText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: CREAM,
  },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.olive[300],
  },
  couponAppliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  couponAppliedCode: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13.5,
    letterSpacing: 1.2,
    color: colors.light.foreground,
  },
  couponAppliedSub: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[700],
  },
  couponRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCard: {
    ...surfaceCard,
    padding: 16,
    gap: 10,
  },
  receiptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  receiptIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  receiptLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  receiptRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: 2,
  },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLineLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.ink.soft,
  },
  summaryLineLabelMuted: {
    color: colors.light.mutedForeground,
  },
  summaryLineValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  summaryLineValueAccent: {
    color: colors.olive[600],
  },
  summaryLineValueMuted: {
    color: colors.light.mutedForeground,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  totalLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  totalTaxNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  totalPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: INK,
  },
  loyaltyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#f6efdc",
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}44`,
  },
  loyaltyIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  loyaltyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  loyaltySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.ink.mute,
    marginTop: 1,
  },
  earnPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
  },
  earnPillText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.olive[800],
  },
  earnPillHighlight: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  trustRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 4,
  },
  trustBadge: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
  },
  trustLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },

  /* ---- Sticky footer ---- */
  reviewFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },
  reviewFooterTotal: {
    flexShrink: 1,
  },
  reviewFooterLabel: {
    ...kickerText,
  },
  reviewFooterPrice: {
    marginTop: 2,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.6,
    color: colors.light.foreground,
  },
  reviewFooterSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  placeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    minWidth: 168,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: INK,
    ...shadows.glow,
    shadowColor: INK,
  },
  placeOrderText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    color: CREAM,
    letterSpacing: 0.2,
  },
});
