/**
 * Inventory + cache unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isProductInStock,
  inStockVariantCount,
  minVariantStock,
} from "../inventory";
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheClear,
  cacheBustPrefix,
  cacheKey,
} from "../cache";
import type { Product, ProductVariant } from "@/lib/types";

function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "v",
    product_id: "p",
    size: "M",
    color: "Black",
    position: 0,
    is_active: true,
    stock: 5,
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    store_id: "s1",
    name: "P",
    slug: "p",
    product_type: "simple",
    mrp: 100,
    price: 100,
    currency: "LKR",
    discount_pct: 0,
    tax_rate: 0,
    status: "active",
    tags: [],
    is_featured: false,
    is_active: true,
    rating: 0,
    total_reviews: 0,
    total_sales: 0,
    view_count: 0,
    wishlist_count: 0,
    created_at: new Date().toISOString(),
    variants: [variant()],
    ...over,
  };
}

/* ----------------------------- inventory ------------------------------ */

describe("isProductInStock", () => {
  it("returns true when at least one variant has stock > 0", () => {
    expect(
      isProductInStock(
        product({
          variants: [variant({ stock: 0 }), variant({ stock: 3 })],
        }),
      ),
    ).toBe(true);
  });

  it("returns false when all variants are out of stock", () => {
    expect(
      isProductInStock(
        product({
          variants: [variant({ stock: 0 }), variant({ stock: 0 })],
        }),
      ),
    ).toBe(false);
  });

  it("treats inactive variants as not purchasable", () => {
    expect(
      isProductInStock(
        product({
          variants: [variant({ stock: 10, is_active: false })],
        }),
      ),
    ).toBe(false);
  });

  it("treats missing stock field as purchasable when active", () => {
    expect(
      isProductInStock(
        product({
          variants: [variant({ stock: undefined })],
        }),
      ),
    ).toBe(true);
  });

  it("for variantless product, falls back to is_active", () => {
    expect(isProductInStock(product({ variants: [], is_active: true }))).toBe(true);
    expect(isProductInStock(product({ variants: [], is_active: false }))).toBe(false);
  });
});

describe("inStockVariantCount", () => {
  it("counts active variants with stock > 0", () => {
    const n = inStockVariantCount(
      product({
        variants: [
          variant({ stock: 5 }),
          variant({ stock: 0 }),
          variant({ stock: 3, is_active: false }),
          variant({ stock: 2 }),
        ],
      }),
    );
    expect(n).toBe(2);
  });

  it("returns 0 for variantless product", () => {
    expect(inStockVariantCount(product({ variants: [] }))).toBe(0);
  });
});

describe("minVariantStock", () => {
  it("returns the lowest stock across active variants", () => {
    expect(
      minVariantStock(
        product({
          variants: [variant({ stock: 5 }), variant({ stock: 1 }), variant({ stock: 10 })],
        }),
      ),
    ).toBe(1);
  });

  it("returns Infinity when no stock info is present", () => {
    expect(
      minVariantStock(
        product({
          variants: [variant({ stock: undefined })],
        }),
      ),
    ).toBe(Infinity);
  });

  it("ignores inactive variants", () => {
    expect(
      minVariantStock(
        product({
          variants: [variant({ stock: 0, is_active: false }), variant({ stock: 7 })],
        }),
      ),
    ).toBe(7);
  });
});

/* ------------------------------- cache -------------------------------- */

describe("cache (in-memory TTL)", () => {
  beforeEach(() => {
    cacheClear();
    vi.useRealTimers();
  });

  it("round-trips a value", () => {
    cacheSet("k", { a: 1 });
    expect(cacheGet<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("returns null for missing keys", () => {
    expect(cacheGet("nope")).toBeNull();
  });

  it("expires after TTL", () => {
    vi.useFakeTimers();
    cacheSet("k", "v", 1000);
    expect(cacheGet("k")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(cacheGet("k")).toBeNull();
  });

  it("cacheDelete removes a single key", () => {
    cacheSet("a", 1);
    cacheSet("b", 2);
    cacheDelete("a");
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBe(2);
  });

  it("cacheBustPrefix removes only matching keys", () => {
    cacheSet("for-you:u1", 1);
    cacheSet("for-you:u2", 2);
    cacheSet("recent:u1", 3);
    cacheBustPrefix("for-you:");
    expect(cacheGet("for-you:u1")).toBeNull();
    expect(cacheGet("for-you:u2")).toBeNull();
    expect(cacheGet("recent:u1")).toBe(3);
  });

  it("cacheKey joins parts, skipping nullish/empty", () => {
    expect(cacheKey("a", "b", "c")).toBe("a::b::c");
    expect(cacheKey("a", undefined, null, "", "b")).toBe("a::b");
    expect(cacheKey("u", 1, "rail")).toBe("u::1::rail");
  });

  it("evicts the oldest entry past MAX_ENTRIES (32)", () => {
    // We can't import the constant directly; set 33 unique keys and assert the
    // first is gone.
    for (let i = 0; i < 33; i++) cacheSet(`k${i}`, i);
    expect(cacheGet("k0")).toBeNull();
    expect(cacheGet("k32")).toBe(32);
  });
});
