import { describe, it, expect } from "vitest";
import { getAvailableStock, getVariantAvailableStock } from "@/lib/inventory";

describe("inventory", () => {
  it("computes available stock as quantity minus reserved", () => {
    expect(getAvailableStock({ quantity: 10, reserved: 3 })).toBe(7);
    expect(getAvailableStock({ quantity: 5, reserved: 8 })).toBe(0);
    expect(getAvailableStock(null, 4)).toBe(4);
  });

  it("reads available stock from variant inventory join", () => {
    const stock = getVariantAvailableStock({
      inventory: [{ quantity: 12, reserved: 4 }],
      stock: 99,
    });
    expect(stock).toBe(8);
  });

  it("falls back to variant.stock when inventory is missing", () => {
    expect(getVariantAvailableStock({ stock: 6 })).toBe(6);
  });
});

