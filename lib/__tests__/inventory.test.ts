import { describe, it, expect } from "vitest";
import {
  getAvailableStock,
  getProductAvailableStock,
  getVariantAvailableStock,
  readInventoryQuantities,
  summarizeInventoryHealth,
  variantHasStockSignal,
} from "@/lib/inventory";

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

describe("summarizeInventoryHealth", () => {
  it("counts PostgREST inventory arrays the same as nested objects", () => {
    expect(
      summarizeInventoryHealth([
        { inventory: [{ quantity: 20, reserved: 2 }] },
        { inventory: [{ quantity: 4, reserved: 0 }] },
        { inventory: [{ quantity: 0, reserved: 0 }] },
      ]),
    ).toEqual({
      totalSkus: 3,
      healthyCount: 1,
      lowStockVariants: 1,
      outOfStockVariants: 1,
    });
  });

  it("counts nested inventory rows into healthy / low / out buckets", () => {
    expect(
      summarizeInventoryHealth([
        { inventory: { quantity: 20, reserved: 2 } },
        { inventory: { quantity: 4, reserved: 0 } },
        { inventory: { quantity: 0, reserved: 0 } },
        { inventory: { quantity: 2, reserved: 2 } },
      ]),
    ).toEqual({
      totalSkus: 4,
      healthyCount: 1,
      lowStockVariants: 1,
      outOfStockVariants: 2,
    });
  });

  it("does not treat in-stock SKUs as out of stock when quantity is flat", () => {
    expect(
      summarizeInventoryHealth([
        { quantity: 12, reserved: 1 },
        { stock: 8 },
        { available: 0 },
      ]),
    ).toEqual({
      totalSkus: 3,
      healthyCount: 2,
      lowStockVariants: 0,
      outOfStockVariants: 1,
    });
  });

  it("skips archived and rejected catalogue rows", () => {
    expect(
      summarizeInventoryHealth([
        { product: { status: "active" }, inventory: { quantity: 0, reserved: 0 } },
        { product: { status: "archived" }, inventory: { quantity: 0, reserved: 0 } },
        { product: { status: "rejected" }, inventory: { quantity: 3, reserved: 0 } },
      ]),
    ).toEqual({
      totalSkus: 1,
      healthyCount: 0,
      lowStockVariants: 0,
      outOfStockVariants: 1,
    });
  });

  it("does not count rows with no stock fields as out of stock", () => {
    expect(
      summarizeInventoryHealth([
        { sku: "ghost" } as never,
        { product: { status: "active" } },
        { inventory: {} },
      ]),
    ).toEqual({
      totalSkus: 0,
      healthyCount: 0,
      lowStockVariants: 0,
      outOfStockVariants: 0,
    });
  });

  it("reads on_hand / qty aliases from the live inventory payload", () => {
    expect(
      summarizeInventoryHealth([
        { on_hand: 14, reserved: 2 },
        { qty: 0 },
      ]),
    ).toEqual({
      totalSkus: 2,
      healthyCount: 1,
      lowStockVariants: 0,
      outOfStockVariants: 1,
    });
  });
});

describe("getProductAvailableStock", () => {
  it("returns null when variants and product stock are missing", () => {
    expect(getProductAvailableStock({ name: "x" } as never)).toBeNull();
    expect(getProductAvailableStock({ variants: [] })).toBeNull();
    expect(getProductAvailableStock({ variants: [{ sku: "a" }] })).toBeNull();
  });

  it("treats explicit 0 as out of stock, not unknown", () => {
    expect(getProductAvailableStock({ variants: [{ stock: 0 }] })).toBe(0);
  });

  it("sums sellable stock across variants and prefers inventory joins", () => {
    expect(
      getProductAvailableStock({
        variants: [
          { inventory: [{ quantity: 12, reserved: 2 }], stock: 99 },
          { stock: 3 },
        ],
      }),
    ).toBe(13);
  });

  it("falls back to product.stock when there are no variants", () => {
    expect(getProductAvailableStock({ stock: 8, variants: [] })).toBe(8);
  });
});

describe("variantHasStockSignal", () => {
  it("does not treat an empty variant as a stock figure", () => {
    expect(variantHasStockSignal({})).toBe(false);
    expect(variantHasStockSignal({ stock: 0 })).toBe(true);
  });
});

describe("readInventoryQuantities", () => {
  it("returns null stock when the payload has no quantity fields", () => {
    expect(readInventoryQuantities({ product: { status: "active" } })).toEqual({
      quantity: null,
      reserved: 0,
      available: null,
    });
  });

  it("treats explicit 0 as out of stock, not unknown", () => {
    expect(readInventoryQuantities({ quantity: 0, reserved: 0 })).toEqual({
      quantity: 0,
      reserved: 0,
      available: 0,
    });
  });

  it("prefers nested inventory quantity minus reserved", () => {
    expect(readInventoryQuantities({ inventory: { quantity: 12, reserved: 2 } })).toEqual({
      quantity: 12,
      reserved: 2,
      available: 10,
    });
  });

  it("reads PostgREST inventory embeds as an array (GET /api/seller/inventory)", () => {
    expect(
      readInventoryQuantities({
        inventory: [{ quantity: 12, reserved: 2, low_stock_threshold: 5 }],
      }),
    ).toEqual({
      quantity: 12,
      reserved: 2,
      available: 10,
    });
  });

  it("sums warehouse rows when a variant has several inventory records", () => {
    expect(
      readInventoryQuantities({
        inventory: [
          { quantity: 10, reserved: 1 },
          { quantity: 5, reserved: 2 },
        ],
      }),
    ).toEqual({
      quantity: 15,
      reserved: 3,
      available: 12,
    });
  });

  it("keeps empty inventory arrays as unknown, not zero", () => {
    expect(readInventoryQuantities({ inventory: [] })).toEqual({
      quantity: null,
      reserved: 0,
      available: null,
    });
  });
});

