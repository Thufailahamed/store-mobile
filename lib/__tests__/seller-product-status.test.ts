import { describe, it, expect } from "vitest";
import {
  coerceSellerProductStatus,
  resolveProductType,
} from "@/lib/seller-product-status";

describe("seller-product-status (mobile)", () => {
  it("blocks seller self-publish", () => {
    expect(coerceSellerProductStatus("active")).toBe("pending");
    expect(coerceSellerProductStatus("active", "active")).toBe("active");
  });

  it("sets variable product type when variants exist", () => {
    expect(resolveProductType(3)).toBe("variable");
  });
});
