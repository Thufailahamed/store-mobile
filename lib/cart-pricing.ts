import {
  DEFAULT_CHECKOUT_PRICING,
  type CheckoutPricing,
  type ShippingKey,
} from "@/lib/utils";

export type CartPricingLine = {
  storeId: string;
  quantity: number;
  unitPrice: number;
};

/** Delivery fee for one store sub-order with the chosen speed. */
export function shippingFeeFor(
  shippingKey: ShippingKey,
  pricing: CheckoutPricing = DEFAULT_CHECKOUT_PRICING,
): number {
  if (shippingKey === "express") return pricing.express_fee;
  if (shippingKey === "overnight") return pricing.overnight_fee;
  return pricing.delivery_fee;
}

/** Platform fee on an already-discounted amount. */
export function platformFeeFor(
  amount: number,
  pricing: CheckoutPricing = DEFAULT_CHECKOUT_PRICING,
): number {
  return Math.max(0, amount) * pricing.platform_fee_pct / 100;
}

/** Delivery is charged once per store in the cart; a free-shipping coupon waives it. */
export function computeOrderShipping(
  lines: CartPricingLine[],
  shippingKey: ShippingKey = "standard",
  options?: { freeShippingCoupon?: boolean; pricing?: CheckoutPricing },
): number {
  if (options?.freeShippingCoupon || lines.length === 0) return 0;
  return countStoresInCart(lines) * shippingFeeFor(shippingKey, options?.pricing);
}

export function computeCartTotals(params: {
  lines: CartPricingLine[];
  shippingKey?: ShippingKey;
  couponDiscount?: number;
  pointsValue?: number;
  freeShippingCoupon?: boolean;
  giftCardCredit?: number;
  pricing?: CheckoutPricing;
}) {
  const sub = params.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const shipping = computeOrderShipping(params.lines, params.shippingKey ?? "standard", {
    freeShippingCoupon: params.freeShippingCoupon,
    pricing: params.pricing,
  });
  const afterCoupon = Math.max(0, sub - (params.couponDiscount ?? 0));
  const afterPoints = Math.max(0, afterCoupon - (params.pointsValue ?? 0));
  // Platform fee (lands in orders.tax). Not rounded — matches
  // store/src/lib/utils.ts; the backend re-prices each sub-order anyway.
  const tax = platformFeeFor(afterPoints, params.pricing);
  const due = afterPoints + shipping + tax;
  const giftApplied = Math.min(Math.max(0, params.giftCardCredit ?? 0), Math.max(0, due));
  const total = Math.max(0, due - giftApplied);
  return { sub, shipping, tax, total, afterCoupon, afterPoints, giftApplied };
}

export function countStoresInCart(lines: CartPricingLine[]): number {
  return new Set(lines.map((line) => line.storeId)).size;
}
