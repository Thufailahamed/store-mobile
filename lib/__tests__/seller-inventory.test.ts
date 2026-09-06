import { describe, it, expect } from "vitest";
import { sellerStatus, groupSellerRows, sellerBarPct } from "@/lib/seller-inventory";
import type { SellerInventoryRow } from "@/lib/seller-inventory";

const row = (over: Partial<SellerInventoryRow>): SellerInventoryRow => ({
  productId: "p1",
  productName: "Linen Shirt",
  variantId: over.variantId ?? "v1",
  sku: "SKU-1",
  onHand: 10,
  reserved: 2,
  available: 8,
  price: 8500,
  currency: "LKR",
  ...over,
});

describe("seller-inventory helpers", () => {
  it("maps null to unknown, 0 to out, 5 to low, 6 to ok", () => {
    expect(sellerStatus(null)).toBe("unknown");
    expect(sellerStatus(0)).toBe("out");
    expect(sellerStatus(5)).toBe("low");
    expect(sellerStatus(6)).toBe("ok");
  });

  it("groups rows by productId with worst status first", () => {
    const groups = groupSellerRows([
      row({ variantId: "v1", available: 20 }),
      row({ variantId: "v2", available: 0 }),
      row({ variantId: "v3", productId: "p2", productName: "Tee", available: 3 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].worst).toBe("out");
    expect(groups[1].worst).toBe("low");
  });

  it("computes bar percent clamped 0-100, unknown is 0", () => {
    expect(sellerBarPct(10)).toBe(50);
    expect(sellerBarPct(40)).toBe(100);
    expect(sellerBarPct(0)).toBe(0);
    expect(sellerBarPct(null)).toBe(0);
  });
});
