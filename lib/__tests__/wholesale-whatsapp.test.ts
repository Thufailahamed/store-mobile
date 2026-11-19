import { describe, expect, it } from "vitest";
import { buildWholesaleWhatsappUrl, wholesaleQty, wholesaleQtyBounds } from "@/lib/wholesale-order";

const product = {
  name: "Cotton Poplin Shirt",
  price: 2450,
  currency: "LKR",
  sku: "WH-SH-01",
  slug: "cotton-poplin-shirt",
  wholesale_moq: 12,
  wholesale_pack_size: 6,
  wholesale_lead_time: "7–10 days",
};

describe("wholesale quantity", () => {
  it("defaults invalid MOQ/pack to 1", () => {
    expect(wholesaleQtyBounds({ wholesale_moq: 0, wholesale_pack_size: -2 })).toEqual({ moq: 1, pack: 1 });
  });

  it("never goes below MOQ and rounds up to a pack multiple", () => {
    expect(wholesaleQty(1, product)).toBe(12);
    expect(wholesaleQty(13, product)).toBe(18);
    expect(wholesaleQty(18, product)).toBe(18);
    expect(wholesaleQty(19, product)).toBe(24);
  });
});

describe("buildWholesaleWhatsappUrl", () => {
  it("includes product, MOQ, quantity, price, reference and lead time", () => {
    const url = buildWholesaleWhatsappUrl("+94 77 123 4567", product, {
      variant: { size: "M", color: "Ivory", price: 2450, sku: "WH-SH-01-M" },
      qty: 18,
    });
    const text = decodeURIComponent(url.split("text=")[1] ?? "");

    expect(url.startsWith("https://wa.me/94771234567?text=")).toBe(true);
    expect(text).toContain("Cotton Poplin Shirt");
    expect(text).toContain("Style: Ivory / M");
    expect(text).toContain("Qty: 18 pcs (MOQ 12, pack of 6)");
    expect(text).toContain("Unit price: LKR");
    expect(text).toContain("Ref: WH-SH-01-M");
    expect(text).toContain("Lead time: 7–10 days");
    expect(text).toContain("/wholesale/cotton-poplin-shirt");
  });

  it("defaults quantity to the MOQ", () => {
    const url = buildWholesaleWhatsappUrl("94771234567", product);
    const text = decodeURIComponent(url.split("text=")[1] ?? "");
    expect(text).toContain("Qty: 12 pcs");
  });
});
