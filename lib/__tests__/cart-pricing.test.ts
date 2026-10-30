import { describe, it, expect } from "vitest";
import { computeCartTotals, computeOrderShipping } from "@/lib/cart-pricing";

describe("cart-pricing", () => {
  it("charges shipping once per store", () => {
    const lines = [
      { storeId: "s1", quantity: 1, unitPrice: 5000 },
      { storeId: "s2", quantity: 1, unitPrice: 4000 },
    ];
    expect(computeOrderShipping(lines, "express")).toBe(3000);
  });

  it("still charges delivery on high-value orders (no free threshold)", () => {
    const lines = [{ storeId: "s1", quantity: 1, unitPrice: 20000 }];
    expect(computeOrderShipping(lines, "standard")).toBe(500);
  });

  it("waives delivery with a free-shipping coupon", () => {
    const lines = [{ storeId: "s1", quantity: 1, unitPrice: 20000 }];
    expect(computeOrderShipping(lines, "express", { freeShippingCoupon: true })).toBe(0);
  });

  it("applies admin-set platform fee and delivery fee", () => {
    const totals = computeCartTotals({
      lines: [
        { storeId: "s1", quantity: 1, unitPrice: 10000 },
        { storeId: "s2", quantity: 1, unitPrice: 10000 },
      ],
      pricing: { platform_fee_pct: 5, delivery_fee: 700, express_fee: 1500, overnight_fee: 3500 },
    });
    expect(totals.shipping).toBe(1400);
    expect(totals.tax).toBe(1000);
    expect(totals.total).toBe(22400);
  });

  it("matches checkout-style totals", () => {
    const totals = computeCartTotals({
      lines: [{ storeId: "s1", quantity: 2, unitPrice: 2500 }],
      shippingKey: "standard",
    });
    expect(totals.sub).toBe(5000);
    expect(totals.shipping).toBe(500);
    expect(totals.tax).toBe(400);
    expect(totals.total).toBe(5900);
    expect(totals.giftApplied).toBe(0);
  });

  it("subtracts gift card credit from the payable total", () => {
    const totals = computeCartTotals({
      lines: [{ storeId: "s1", quantity: 2, unitPrice: 2500 }],
      shippingKey: "standard",
      giftCardCredit: 1000,
    });
    expect(totals.giftApplied).toBe(1000);
    expect(totals.total).toBe(4900);
  });
});
