/**
 * Performance benchmark tests for the mobile app.
 *
 * These tests measure cold-call latency of critical code paths
 * (recommender ranking, search utilities, data mappers, delivery workflow)
 * to ensure they stay well within interactive response budgets.
 *
 * Target: every test must complete within its stated budget.
 * Budgets are generous (10×–50× expected times) to avoid flaking in CI.
 */

import { describe, it, expect } from "vitest";

// ── recommender perf ────────────────────────────────────────────────────────
describe("performance: recommender ranking", () => {
  it("ranks 500 products in < 50ms", async () => {
    const { rankProducts } = await import("@/lib/recommender/rank");
    const { EMPTY_PROFILE } = await import("@/lib/recommender/profile");

    const products = Array.from({ length: 500 }, (_, i) => ({
      id: `p-${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      category_id: `cat-${i % 10}`,
      brand_id: `brand-${i % 5}`,
      store_id: `store-${i % 8}`,
      material: i % 3 === 0 ? "cotton" : i % 3 === 1 ? "silk" : "polyester",
      gender: "unisex",
      price: 100 + i,
      colors: ["black", "white"],
      average_rating: 3 + Math.random() * 2,
      rating: 3 + Math.random() * 2,
      total_reviews: 10,
      total_sales: Math.floor(Math.random() * 1000),
      in_stock: true,
      is_active: true,
      images: [],
      variants: [],
      tags: [],
      created_at: new Date().toISOString(),
    }));

    const profile = {
      ...EMPTY_PROFILE,
      hasSignal: true,
      categories: { "cat-0": 10, "cat-1": 5 },
      brands: { "brand-0": 8 },
      materials: { cotton: 6 },
    };

    const start = performance.now();
    const result = rankProducts(products as any, profile, { limit: 50 });
    const elapsed = performance.now() - start;

    expect(result.length).toBe(50);
    expect(elapsed).toBeLessThan(50);
  });

  it("personalizeResults for 200 items in < 20ms", async () => {
    const { personalizeResults } = await import("@/lib/recommender/rank");
    const { EMPTY_PROFILE } = await import("@/lib/recommender/profile");

    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `p-${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      category_id: `cat-${i % 8}`,
      brand_id: `brand-${i % 4}`,
      store_id: `store-${i % 6}`,
      material: "cotton",
      gender: "unisex",
      price: 50 + i,
      colors: ["blue"],
      average_rating: 4,
      rating: 4,
      total_reviews: 10,
      total_sales: 100,
      in_stock: true,
      is_active: true,
      images: [],
      variants: [],
      tags: [],
      created_at: new Date().toISOString(),
    }));

    const profile = {
      ...EMPTY_PROFILE,
      hasSignal: true,
      categories: { "cat-0": 10 },
      brands: { "brand-0": 5 },
    };

    const start = performance.now();
    const result = personalizeResults(items as any, profile);
    const elapsed = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20);
  });
});

// ── search utils perf ───────────────────────────────────────────────────────
describe("performance: search utilities", () => {
  it("tokenizeQuery + scoreProduct on 300 products in < 30ms", async () => {
    const { tokenizeQuery, scoreProduct } = await import(
      "@/lib/utils/search-utils"
    );

    const products = Array.from({ length: 300 }, (_, i) => ({
      id: `p-${i}`,
      name: `Premium ${i % 2 === 0 ? "Cotton" : "Silk"} ${i % 3 === 0 ? "Shirt" : "Jacket"} ${i}`,
      slug: `product-${i}`,
      description: `High quality ${i % 2 === 0 ? "cotton" : "silk"} garment with fine stitching`,
      short_description: `Quality garment ${i}`,
      category_id: i % 3 === 0 ? "shirts" : "jackets",
      brand_id: `brand-${i % 5}`,
      store_id: `store-${i % 4}`,
      material: i % 2 === 0 ? "cotton" : "silk",
      price: 100 + i,
      tags: ["premium", "new-arrival"],
      variants: [{ color: "blue", size: "M" }],
    }));

    const fullQuery = "cotton shirt premium";
    const tokens = tokenizeQuery(fullQuery);

    const start = performance.now();
    const scores = products.map((p) => scoreProduct(p as any, tokens, fullQuery));
    const elapsed = performance.now() - start;

    expect(scores.length).toBe(300);
    expect(elapsed).toBeLessThan(30);
  });
});

// ── product mapper perf ─────────────────────────────────────────────────────
describe("performance: product mapper", () => {
  it("maps 100 raw products in < 5ms", async () => {
    const { mapProducts } = await import("@/lib/api/product-mapper");

    const rawProducts = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i}`,
      name: `Product ${i}`,
      slug: `product-${i}`,
      price: 100 + i,
      mrp: 150 + i,
      description: `Description for product ${i}`,
      category_id: `cat-${i % 5}`,
      brand_id: `brand-${i % 3}`,
      store_id: `store-${i % 4}`,
      status: "active",
      images: [{ url: `https://cdn.example.com/${i}.jpg`, is_primary: true }],
      variants: [],
      average_rating: 4.2,
      total_reviews: 10 + i,
      total_sales: 50 + i,
      in_stock: true,
      created_at: new Date().toISOString(),
    }));

    const start = performance.now();
    const mapped = mapProducts(rawProducts as any);
    const elapsed = performance.now() - start;

    expect(mapped.length).toBe(100);
    expect(elapsed).toBeLessThan(5);
  });
});

// ── cart line key perf ──────────────────────────────────────────────────────
describe("performance: cart line key generation", () => {
  it("generates 100 line keys in < 2ms", async () => {
    const { buildCartLineKey } = await import("@/lib/cart-line-key");

    const items = Array.from({ length: 100 }, (_, i) => ({
      storeId: `store-${i % 5}`,
      productId: `prod-${i}`,
      variantId: `var-${i % 20}`,
    }));

    const start = performance.now();
    const keys = items.map((item) =>
      buildCartLineKey(item.storeId, item.productId, item.variantId)
    );
    const elapsed = performance.now() - start;

    expect(keys.length).toBe(100);
    expect(keys[0]).toContain("store-0:prod-0:var-0");
    expect(elapsed).toBeLessThan(2);
  });
});

// ── delivery workflow perf ──────────────────────────────────────────────────
describe("performance: delivery workflow guards", () => {
  it("checks 1000 action legality calls in < 10ms", async () => {
    const { isScanActionLegal } = await import("@/lib/delivery-workflow");

    const statuses = [
      "confirmed",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];
    const actions = [
      "start_delivery",
      "verify_otp",
      "verify_customer_qr",
      "fail_delivery",
    ];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const status = statuses[i % statuses.length] as any;
      const action = actions[i % actions.length] as any;
      isScanActionLegal(status, action, { hasProofPhoto: i % 2 === 0 } as any);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});
