import { describe, it, expect } from "vitest";
import { computeCartTotals, computeOrderShipping } from "@/lib/cart-pricing";

describe("cart-pricing", () => {
  it("charges shipping per store below the free-shipping threshold", () => {
    const lines = [
      { storeId: "s1", quantity: 1, unitPrice: 5000 },
      { storeId: "s2", quantity: 1, unitPrice: 4000 },
    ];
    expect(computeOrderShipping(lines, "express")).toBe(3000);
  });

  it("waives shipping when the order subtotal qualifies", () => {
    const lines = [{ storeId: "s1", quantity: 1, unitPrice: 20000 }];
    expect(computeOrderShipping(lines, "express")).toBe(0);
  });

  it("matches checkout-style totals", () => {
    const totals = computeCartTotals({
      lines: [{ storeId: "s1", quantity: 2, unitPrice: 2500 }],
      shippingKey: "standard",
    });
    expect(totals.sub).toBe(5000);
    expect(totals.shipping).toBe(0);
    expect(totals.tax).toBe(400);
    expect(totals.total).toBe(5400);
  });
});
