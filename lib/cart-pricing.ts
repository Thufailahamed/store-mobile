import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_OPTIONS,
  TAX_RATE,
  type ShippingKey,
} from "@/lib/utils";

export type CartPricingLine = {
  storeId: string;
  quantity: number;
  unitPrice: number;
};

/** Per-store shipping when the order-wide subtotal is below the free-shipping threshold. */
export function computeOrderShipping(
  lines: CartPricingLine[],
  shippingKey: ShippingKey = "standard",
  options?: { freeShippingCoupon?: boolean },
): number {
  const fee = SHIPPING_OPTIONS.find((o) => o.key === shippingKey)?.fee ?? 0;
  if (options?.freeShippingCoupon || fee === 0 || lines.length === 0) return 0;

  const orderSub = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (orderSub >= FREE_SHIPPING_THRESHOLD) return 0;

  const subtotalByStore = new Map<string, number>();
  for (const line of lines) {
    subtotalByStore.set(
      line.storeId,
      (subtotalByStore.get(line.storeId) ?? 0) + line.quantity * line.unitPrice,
    );
  }

  let shippingTotal = 0;
  for (const storeSub of subtotalByStore.values()) {
    if (storeSub < FREE_SHIPPING_THRESHOLD) {
      shippingTotal += fee;
    }
  }
  return shippingTotal;
}

export function computeCartTotals(params: {
  lines: CartPricingLine[];
  shippingKey?: ShippingKey;
  couponDiscount?: number;
  pointsValue?: number;
  freeShippingCoupon?: boolean;
}) {
  const sub = params.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const shipping = computeOrderShipping(params.lines, params.shippingKey ?? "standard", {
    freeShippingCoupon: params.freeShippingCoupon,
  });
  const afterCoupon = Math.max(0, sub - (params.couponDiscount ?? 0));
  const afterPoints = Math.max(0, afterCoupon - (params.pointsValue ?? 0));
  const tax = Math.round(afterPoints * TAX_RATE);
  const total = afterPoints + shipping + tax;
  return { sub, shipping, tax, total, afterCoupon, afterPoints };
}

export function countStoresInCart(lines: CartPricingLine[]): number {
  return new Set(lines.map((line) => line.storeId)).size;
}
