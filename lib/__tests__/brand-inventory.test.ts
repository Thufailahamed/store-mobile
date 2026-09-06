import { describe, it, expect } from "vitest";
import {
  getAvailable,
  getStatus,
  groupByProduct,
  filterRows,
  sortRows,
  buildOptimisticQuantity,
  parseStockInput,
} from "@/lib/brand-inventory";
import type { BrandInventoryRow } from "@/lib/api/backend";

const row = (over: Partial<BrandInventoryRow> & { q?: number; r?: number }): BrandInventoryRow => ({
  id: over.id ?? "v1",
  sku: over.sku ?? "SKU-1",
  size: over.size ?? "M",
  color: over.color ?? "White",
  price: 8500,
  product: { id: "p1", name: "Linen Shirt", status: "active" },
  inventory: { quantity: over.q ?? 10, reserved: over.r ?? 2 },
});

describe("brand-inventory helpers", () => {
  it("computes available as quantity minus reserved, clamped at 0", () => {
    expect(getAvailable(row({ q: 10, r: 3 }))).toBe(7);
    expect(getAvailable(row({ q: 2, r: 5 }))).toBe(0);
    expect(getAvailable({ ...row({}), inventory: null })).toBe(0);
  });

  it("maps thresholds 0=out, 5=low, 6=healthy", () => {
    expect(getStatus(0)).toBe("out");
    expect(getStatus(5)).toBe("low");
    expect(getStatus(6)).toBe("healthy");
  });

  it("groups rows by product", () => {
    const a = row({ id: "v1" });
    const b = { ...row({ id: "v2" }), inventory: { quantity: 0, reserved: 0 } };
    const groups = groupByProduct([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].worst).toBe("out");
  });

  it("filters by status and search query", () => {
    const healthy = row({ id: "v1", q: 20, r: 0 });
    const out = { ...row({ id: "v2", sku: "LS-WHT-M" }), inventory: { quantity: 0, reserved: 0 } };
    expect(filterRows([healthy, out], "out", "")).toHaveLength(1);
    expect(filterRows([healthy, out], "all", "ls-wht-m")).toHaveLength(1);
    expect(filterRows([healthy, out], "all", "linen")).toHaveLength(2);
  });

  it("sorts by urgency, lowest, name", () => {
    const h = row({ id: "vh", q: 20, r: 0 });
    const l = { ...row({ id: "vl" }), inventory: { quantity: 3, reserved: 0 } };
    const o = { ...row({ id: "vo" }), inventory: { quantity: 0, reserved: 0 } };
    expect(sortRows([h, l, o], "urgency").map((r) => r.id)).toEqual(["vo", "vl", "vh"]);
    expect(sortRows([h, l, o], "lowest").map((r) => r.id)).toEqual(["vo", "vl", "vh"]);
  });

  it("builds optimistic quantity as reserved + available", () => {
    expect(buildOptimisticQuantity(row({ q: 10, r: 2 }), 5)).toBe(7);
  });

  it("parses sheet input strictly 0-9999", () => {
    expect(parseStockInput("42")).toBe(42);
    expect(parseStockInput(" 7 ")).toBe(7);
    expect(parseStockInput("")).toBeNull();
    expect(parseStockInput("4.5")).toBeNull();
    expect(parseStockInput("-1")).toBeNull();
    expect(parseStockInput("10000")).toBeNull();
    expect(parseStockInput("abc")).toBeNull();
  });
});
