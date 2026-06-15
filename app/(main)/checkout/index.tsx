import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader, SectionHeader } from "@/components/layout";
import { PayHereCheckout } from "@/components/payments/PayHereCheckout";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useLoyalty } from "@/lib/hooks/useLoyalty";
import { getPayHereSession } from "@/lib/api/payments";
import { Button, Input, Separator } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { useToast } from "@/components/ui";
import * as api from "@/lib/api";
import {
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  TAX_RATE,
  SHIPPING_OPTIONS,
  type ShippingKey,
} from "@/lib/utils";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import type { Address } from "@/lib/types";

const STEPS = [
  { key: 1, label: "Address" },
  { key: 2, label: "Shipping" },
  { key: 3, label: "Payment" },
  { key: 4, label: "Review" },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();
  const loyalty = useLoyalty();
  const { items, subtotal, couponCode, setCoupon, clear } = useCart();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [payhereVisible, setPayhereVisible] = useState(false);
  const [payhereSession, setPayhereSession] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");
  const [couponInput, setCouponInput] = useState(couponCode || "");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [freeShippingCoupon, setFreeShippingCoupon] = useState(false);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingKey, setShippingKey] = useState<ShippingKey>("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "payhere">("cod");

  const cartItems = Object.values(items);
  const sub = subtotal();
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.key === shippingKey) ?? SHIPPING_OPTIONS[0];
  const baseShipping =
    sub >= FREE_SHIPPING_THRESHOLD || freeShippingCoupon ? 0 : shippingOption.fee || 350;
  const shippingFee = baseShipping;
  const afterCoupon = Math.max(0, sub - couponDiscount);
  const maxRedeemablePts = Math.min(loyalty.state.points, Math.floor(afterCoupon));
  const pointsToUse = usePoints ? Math.floor(maxRedeemablePts / 100) * 100 : 0;
  const pointsValue = pointsToUse;
  const tax = Math.round(Math.max(0, afterCoupon - pointsValue) * TAX_RATE);
  const total = Math.max(0, afterCoupon - pointsValue) + shippingFee + tax;
  const earnEstimate = Math.floor(afterCoupon * 0.05);

  useEffect(() => {
    if (!user) return;
    api.getAddresses(user.id).then((res) => {
      if (res.ok && res.data.length) {
        setSavedAddresses(res.data);
        const def = res.data.find((a) => a.is_default) || res.data[0];
        setSelectedAddressId(def.id);
        fillAddress(def);
      }
    });
  }, [user]);

  const fillAddress = (a: Address) => {
    setFullName(a.full_name);
    setPhone(a.phone);
    setLine1(a.line1);
    setLine2(a.line2 || "");
    setCity(a.city);
    setState(a.state);
    setPostalCode(a.postal_code);
  };

  const applyCoupon = async () => {
    if (!user || !couponInput.trim()) return;
    const res = await api.validateCoupon(couponInput.trim(), user.id, sub);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    if (res.data.message !== "OK" && res.data.message !== "OK_FREE_SHIPPING") {
      toast(res.data.message, "error");
      return;
    }
    setCoupon(couponInput.trim().toUpperCase());
    setCouponId(res.data.couponId);
    setCouponDiscount(res.data.message === "OK_FREE_SHIPPING" ? 0 : res.data.discount);
    setFreeShippingCoupon(res.data.message === "OK_FREE_SHIPPING");
    toast("Coupon applied", "success");
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let addressId: string | null = null;
      if (selectedAddressId === "new") {
        const addressResult = await api.createAddress({
          user_id: user.id,
          type: "home",
          full_name: fullName,
          phone,
          line1,
          line2: line2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country: "LK",
          is_default: false,
        });
        addressId = addressResult.ok ? addressResult.data.id : null;
      } else {
        addressId = selectedAddressId;
      }

      const rpcItems = cartItems.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        store_id: item.storeId,
        product_name: item.name,
        variant_label: item.variantLabel ?? null,
        sku: null,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const shippingAddress = {
        full_name: fullName,
        phone,
        line1,
        line2: line2 || null,
        city,
        state,
        postal_code: postalCode,
        country: "LK",
      };

      const { data: orderData, error } = await supabase.rpc("place_order", {
        p_user_id: user.id,
        p_address_id: addressId,
        p_shipping_address: shippingAddress,
        p_subtotal: sub,
        p_discount: couponDiscount + pointsValue,
        p_shipping_fee: shippingFee,
        p_tax: tax,
        p_total: total,
        p_currency: "LKR",
        p_payment_method: paymentMethod,
        p_coupon_id: couponId,
        p_notes: `Shipping: ${shippingOption.label}`,
        p_items: rpcItems,
      });

      if (error) throw error;

      const order = orderData as { id: string; order_number?: string } | null;
      if (!order?.id) throw new Error("Order created but no id returned");

      if (pointsToUse > 0) {
        const redeemRes = await loyalty.redeem(pointsToUse, order.id);
        if (!redeemRes.ok) {
          await supabase.rpc("cancel_order", { p_order_id: order.id });
          throw new Error(redeemRes.error);
        }
      }

      if (paymentMethod === "payhere") {
        const session = await getPayHereSession(order.id);
        if (!session.ok) throw new Error(session.error);
        setPlacedOrderId(order.id);
        setPayhereSession(session.data);
        setPayhereVisible(true);
        await loyalty.reload();
        return;
      }

      clear();
      await loyalty.reload();
      toast("Order placed", "success");
      router.replace({ pathname: "/(main)/checkout/success" as never, params: { orderId: order.id } });
    } catch (e: any) {
      toast(e?.message || "Order failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 1) router.back();
    else setStep(step - 1);
  };

  return (
    <PaperBackground>
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

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
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
                <Body size="sm" style={{ fontWeight: "600" }}>{a.full_name}</Body>
                <Body muted size="xs">{a.line1}, {a.city}</Body>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addressCard, selectedAddressId === "new" && styles.addressCardActive]}
              onPress={() => setSelectedAddressId("new")}
            >
              <Label style={{ color: colors.light.primary }}>+ New address</Label>
            </TouchableOpacity>
            {selectedAddressId === "new" && (
              <View style={styles.form}>
                <Input label="Full name" value={fullName} onChangeText={setFullName} />
                <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <Input label="Address line 1" value={line1} onChangeText={setLine1} />
                <Input label="Address line 2" value={line2} onChangeText={setLine2} />
                <View style={styles.row}>
                  <View style={styles.half}><Input label="City" value={city} onChangeText={setCity} /></View>
                  <View style={styles.half}><Input label="State" value={state} onChangeText={setState} /></View>
                </View>
                <Input label="Postal code" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
              </View>
            )}
            <Button variant="brand" onPress={() => setStep(2)}>Continue</Button>
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
            {cartItems.map((item, i) => (
              <View key={i} style={styles.reviewRow}>
                <Body size="sm" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Body>
                <Body muted size="sm">×{item.quantity}</Body>
                <Price size="sm">{formatPrice(item.price * item.quantity)}</Price>
              </View>
            ))}
            <Separator style={{ marginVertical: spacing[3] }} />
            <View style={styles.couponRow}>
              <Input
                label="Coupon code"
                value={couponInput}
                onChangeText={setCouponInput}
                placeholder="Enter code"
                containerStyle={{ flex: 1 }}
              />
              <Button variant="outline" size="sm" onPress={applyCoupon} style={{ marginTop: 22 }}>
                Apply
              </Button>
            </View>
            <View style={styles.summaryRow}><Body muted>Subtotal</Body><Body>{formatPrice(sub)}</Body></View>
            {couponDiscount > 0 && (
              <View style={styles.summaryRow}><Body muted>Discount</Body><Body style={{ color: colors.olive[600] }}>-{formatPrice(couponDiscount)}</Body></View>
            )}
            {pointsValue > 0 && (
              <View style={styles.summaryRow}><Body muted>Points</Body><Body style={{ color: colors.olive[600] }}>-{formatPrice(pointsValue)}</Body></View>
            )}
            <View style={styles.summaryRow}><Body muted>Shipping</Body><Body>{shippingFee === 0 ? "FREE" : formatPrice(shippingFee)}</Body></View>
            <View style={styles.summaryRow}><Body muted>Tax</Body><Body>{formatPrice(tax)}</Body></View>
            <Separator style={{ marginVertical: spacing[2] }} />
            <View style={styles.summaryRow}><Display size="lg">Total</Display><Price size="xl">{formatPrice(total)}</Price></View>
            {loyalty.state.points >= 100 && maxRedeemablePts >= 100 && (
              <View style={styles.loyaltyRow}>
                <View style={{ flex: 1 }}>
                  <Body size="sm" style={{ fontWeight: "600" }}>Use loyalty points</Body>
                  <Body muted size="xs">Use {pointsToUse.toLocaleString()} pts · {loyalty.state.points.toLocaleString()} available</Body>
                </View>
                <Switch
                  value={usePoints}
                  onValueChange={setUsePoints}
                  trackColor={{ false: colors.light.border, true: colors.olive[400] }}
                  thumbColor={usePoints ? colors.light.primary : colors.paper.DEFAULT}
                />
              </View>
            )}
            <Body muted size="xs">Earn ≈ {earnEstimate.toLocaleString()} pts when delivered</Body>
            <Button variant="brand" loading={loading} onPress={handlePlaceOrder} style={{ marginTop: spacing[4] }}>
              Place order · {formatPrice(total)}
            </Button>
          </View>
        )}
      </ScrollView>

      {payhereSession && (
        <PayHereCheckout
          visible={payhereVisible}
          action={payhereSession.action}
          fields={payhereSession.fields}
          onClose={() => {
            setPayhereVisible(false);
            toast("Payment cancelled", "error");
            router.replace("/(main)/account/orders");
          }}
          onComplete={() => {
            setPayhereVisible(false);
            clear();
            toast("Payment complete", "success");
            if (placedOrderId) {
              router.replace({ pathname: "/(main)/checkout/success" as never, params: { orderId: placedOrderId } });
            } else {
              router.replace("/(main)/account/orders");
            }
          }}
        />
      )}
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
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
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    gap: 4,
  },
  addressCardActive: { borderColor: colors.light.primary, backgroundColor: colors.olive[50] },
  form: { gap: spacing[3] },
  row: { flexDirection: "row", gap: spacing[3] },
  half: { flex: 1 },
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
  reviewRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: 6 },
  couponRow: { flexDirection: "row", gap: spacing[2], alignItems: "flex-start" },
  loyaltyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
});
