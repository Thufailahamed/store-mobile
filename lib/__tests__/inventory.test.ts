import { describe, it, expect } from "vitest";
import {
  getAvailableStock,
  getVariantAvailableStock,
  summarizeInventoryHealth,
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

