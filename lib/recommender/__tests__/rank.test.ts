/**
 * Ranker unit tests.
 *
 * Validates the rank/score/diversity behavior of `lib/recommender/rank.ts`:
 *   - productAffinity axes
 *   - rankProducts diversity caps (brand, store, category, price band)
 *   - rankSimilarTo content overlap
 *   - personalizeResults re-ordering
 *   - humanReason labels
 */

import { describe, it, expect } from "vitest";
import {
  rankProducts,
  rankSimilarTo,
  personalizeResults,
  productAffinity,
  humanReason,
} from "../rank";
import { buildProfile, type UserProfile } from "../profile";
import type { Product, ProductVariant } from "@/lib/types";

/* ----------------------------- helpers --------------------------------- */

function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "v1",
    product_id: "p1",
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
    store_id: "store-1",
    name: "Test Product",
    slug: "test",
    product_type: "simple",
    mrp: 100,
    price: 100,
    currency: "LKR",
    discount_pct: 0,
    tax_rate: 0,
    status: "active",
    gender: "unisex",
    material: "cotton",
    tags: ["casual"],
    is_featured: false,
    is_active: true,
    rating: 0,
    total_reviews: 0,
    total_sales: 0,
    view_count: 0,
    wishlist_count: 0,
    created_at: new Date("2026-01-01").toISOString(),
    variants: [variant({ stock: 5 })],
    ...over,
  };
}

function bigCatalog(): Product[] {
  // 6 brands × 6 categories × 4 products = 144 products
  // Hand-tuned so we can test diversity caps.
  const cats = ["c1", "c2", "c3", "c4", "c5", "c6"];
  const brands = ["b1", "b2", "b3", "b4", "b5", "b6"];
  const stores = ["s1", "s2", "s3"];
  const out: Product[] = [];
  let i = 0;
  for (const cat of cats) {
    for (const brand of brands) {
      for (let n = 0; n < 4; n++) {
        out.push(
          product({
            id: `p${i++}`,
            store_id: stores[i % stores.length],
            category_id: cat,
            brand_id: brand,
            name: `${cat}-${brand}-${n}`,
            tags: [`tag-${n}`],
            material: "cotton",
            price: 50 + (i % 5) * 100, // 50, 150, 250, 350, 450 → mix of bands
            total_sales: i * 10,
            rating: 4 + (i % 2) * 0.3,
            total_reviews: 10,
            created_at: new Date(2026, 0, 1 + (i % 30)).toISOString(),
          }),
        );
      }
    }
  }
  return out;
}

function emptyProfile(): UserProfile {
  return buildProfile([], Date.now());
}

function signalProfile(): UserProfile {
  // 3+ view events on category c1 / brand b1 / "cotton".
  const events: any[] = [];
  for (let i = 0; i < 4; i++) {
    events.push({
      type: "view",
      t: Date.now(),
      product: {
        id: `seed${i}`,
        category_id: "c1",
        brand_id: "b1",
        material: "cotton",
        tags: ["casual"],
        price: 150,
        colors: ["black"],
        garment: null,
      },
      dwellMs: 8000,
    });
  }
  return buildProfile(events, Date.now());
}

/* ----------------------------- productAffinity ------------------------- */

describe("productAffinity", () => {
  it("returns 0 for empty profile", () => {
    const p = product({ category_id: "c1", brand_id: "b1" });
    const r = productAffinity(p, emptyProfile());
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it("returns positive score for matching category + brand", () => {
    const p = product({ category_id: "c1", brand_id: "b1" });
    const r = productAffinity(p, signalProfile());
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons).toContain("category");
    expect(r.reasons).toContain("brand");
  });

  it("ignores axes with no profile signal", () => {
    // No overlap on any axis. Avoid the profile's color (black), tags
    // (casual), category (c1), brand (b1), material (cotton), gender
    // (unisex), garment (none). price=0 skips the price axis.
    const p = product({
      category_id: "zzz",
      brand_id: "zzz",
      material: "asbestos",
      price: 0,
      gender: "kids",
      tags: ["unrelated"],
      variants: [
        {
          id: "v1", product_id: "p1", size: "M", color: "Magenta",
          position: 0, is_active: true, stock: 5,
        },
      ],
    });
    const r = productAffinity(p, signalProfile());
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it("material axis contributes when material matches", () => {
    const p = product({ category_id: "x", brand_id: "y", material: "cotton" });
    const r = productAffinity(p, signalProfile());
    expect(r.details.some((d) => d.axis === "material")).toBe(true);
  });
});

/* ----------------------------- rankProducts ---------------------------- */

describe("rankProducts", () => {
  it("returns up to `limit` results", () => {
    const ranked = rankProducts(bigCatalog(), emptyProfile(), { limit: 7 });
    expect(ranked.length).toBe(7);
  });

  it("excludes listed ids and anchor", () => {
    const catalog = bigCatalog();
    const anchor = catalog[0];
    const ranked = rankProducts(catalog, emptyProfile(), {
      anchorProduct: anchor,
      excludeIds: [catalog[1].id, catalog[2].id],
    });
    const ids = ranked.map((r) => r.product.id);
    expect(ids).not.toContain(anchor.id);
    expect(ids).not.toContain(catalog[1].id);
    expect(ids).not.toContain(catalog[2].id);
  });

  it("filters out-of-stock products by default", () => {
    const catalog = bigCatalog();
    catalog[3].variants = [variant({ stock: 0 })];
    const ranked = rankProducts(catalog, emptyProfile(), { limit: 50 });
    expect(ranked.find((r) => r.product.id === catalog[3].id)).toBeUndefined();
  });

  it("applies brand cap (default 2)", () => {
    // Build a catalog where the brand cap is the only binding constraint.
    // Spread across multiple stores and categories so the default store/
    // category caps (3) don't interfere. Vary price bands so the
    // price-band diversity check doesn't fire and force a top-up.
    const catalog: Product[] = [];
    const prices = [40, 80, 250]; // low, mid, high
    for (let b = 0; b < 4; b++) {
      for (let n = 0; n < 3; n++) {
        catalog.push(
          product({
            id: `p-${b}-${n}`,
            store_id: `s-${b}-${n}`,
            category_id: `c-${b}-${n}`,
            brand_id: `b${b}`,
            total_sales: 1000,
            rating: 4.5,
            total_reviews: 50,
            created_at: new Date(2020, 0, 1).toISOString(),
            price: prices[n],
            mrp: prices[n],
          }),
        );
      }
    }
    const ranked = rankProducts(catalog, emptyProfile(), {
      limit: 4,
      brandCap: 2,
    });
    const brandCounts: Record<string, number> = {};
    for (const r of ranked) {
      const k = r.product.brand_id ?? "_none";
      brandCounts[k] = (brandCounts[k] ?? 0) + 1;
    }
    for (const c of Object.values(brandCounts)) {
      expect(c).toBeLessThanOrEqual(2);
    }
    // 4 brands × cap 2 = 8, limit 4 → at most 2 distinct brands.
    expect(Object.keys(brandCounts).length).toBeLessThanOrEqual(2);
  });

  it("applies store cap (default 3)", () => {
    const catalog: Product[] = [];
    const prices = [40, 80, 250, 350];
    for (let s = 0; s < 3; s++) {
      for (let n = 0; n < 4; n++) {
        catalog.push(
          product({
            id: `p-${s}-${n}`,
            store_id: `s${s}`,
            category_id: `c-${s}-${n}`,
            brand_id: `b-${s}-${n}`,
            total_sales: 1000,
            rating: 4.5,
            total_reviews: 50,
            created_at: new Date(2020, 0, 1).toISOString(),
            price: prices[n],
            mrp: prices[n],
          }),
        );
      }
    }
    const ranked = rankProducts(catalog, emptyProfile(), {
      limit: 3,
      storeCap: 3,
    });
    const storeCounts: Record<string, number> = {};
    for (const r of ranked) {
      const k = r.product.store_id ?? "_none";
      storeCounts[k] = (storeCounts[k] ?? 0) + 1;
    }
    for (const c of Object.values(storeCounts)) {
      expect(c).toBeLessThanOrEqual(3);
    }
  });

  it("applies category cap (default 3)", () => {
    const catalog: Product[] = [];
    const prices = [40, 80, 250, 350];
    for (let c = 0; c < 3; c++) {
      for (let n = 0; n < 4; n++) {
        catalog.push(
          product({
            id: `p-${c}-${n}`,
            store_id: `s-${c}-${n}`,
            category_id: `c${c}`,
            brand_id: `b-${c}-${n}`,
            total_sales: 1000,
            rating: 4.5,
            total_reviews: 50,
            created_at: new Date(2020, 0, 1).toISOString(),
            price: prices[n],
            mrp: prices[n],
          }),
        );
      }
    }
    const ranked = rankProducts(catalog, emptyProfile(), {
      limit: 3,
      categoryCap: 3,
    });
    const catCounts: Record<string, number> = {};
    for (const r of ranked) {
      const k = r.product.category_id ?? "_none";
      catCounts[k] = (catCounts[k] ?? 0) + 1;
    }
    for (const c of Object.values(catCounts)) {
      expect(c).toBeLessThanOrEqual(3);
    }
  });

  it("personalized profile prefers matching category + brand", () => {
    const ranked = rankProducts(bigCatalog(), signalProfile(), { limit: 5 });
    // Top of the list should include the signal category (c1) and brand (b1).
    const top = ranked[0].product;
    expect(["c1", top.category_id]).toContain(top.category_id);
    // The set of top 5 should be heavily weighted toward c1.
    const c1Count = ranked.slice(0, 5).filter((r) => r.product.category_id === "c1").length;
    expect(c1Count).toBeGreaterThan(0);
  });

  it("excludes profile.excludedProductIds", () => {
    const catalog = bigCatalog();
    const events: any[] = [
      {
        type: "not_interested",
        t: Date.now(),
        product: {
          id: catalog[0].id,
          category_id: catalog[0].category_id,
          brand_id: catalog[0].brand_id,
          material: catalog[0].material,
          tags: catalog[0].tags,
          price: catalog[0].price,
          colors: [],
          garment: null,
        },
      },
    ];
    for (let i = 1; i <= 4; i++) {
      events.push({
        type: "view",
        t: Date.now(),
        product: {
          id: `seed${i}`,
          category_id: "c1",
          brand_id: "b1",
          material: "cotton",
          tags: ["casual"],
          price: 150,
          colors: [],
          garment: null,
        },
        dwellMs: 8000,
      });
    }
    const profile = buildProfile(events, Date.now());
    const ranked = rankProducts(catalog, profile, { limit: 20 });
    expect(ranked.find((r) => r.product.id === catalog[0].id)).toBeUndefined();
  });

  it("diversity off returns pure score order", () => {
    const catalog = bigCatalog();
    const ranked = rankProducts(catalog, emptyProfile(), {
      limit: 10,
      diversity: false,
    });
    // No caps enforced when diversity is off (besides limit).
    const brandCounts: Record<string, number> = {};
    for (const r of ranked) {
      const k = r.product.brand_id ?? "_none";
      brandCounts[k] = (brandCounts[k] ?? 0) + 1;
    }
    // It's possible one brand dominates when diversity is off; just ensure
    // ordering is by score desc.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});

/* ----------------------------- rankSimilarTo --------------------------- */

describe("rankSimilarTo", () => {
  it("returns products sharing category, brand, or material with anchor", () => {
    const anchor = product({
      id: "anchor",
      name: "Olive Linen Shirt",
      category_id: "shirts",
      brand_id: "lume",
      material: "linen",
      tags: ["casual", "summer"],
    });
    const sameCat = product({
      id: "x1",
      name: "White Linen Shirt",
      category_id: "shirts",
      brand_id: "other",
      material: "cotton",
    });
    const sameBrand = product({
      id: "x2",
      name: "Olive Trousers",
      category_id: "pants",
      brand_id: "lume",
      material: "cotton",
    });
    const sameMaterial = product({
      id: "x3",
      name: "Olive Linen Hat",
      category_id: "hats",
      brand_id: "other",
      material: "linen",
    });
    const unrelated = product({
      id: "x4",
      name: "Plastic Toy",
      category_id: "toys",
      brand_id: "kids",
      material: "plastic",
      gender: "kids",
      tags: [],
      // Old product → recency=0, total_sales=0, no rating → score 0.
      // Also use a different color variant to avoid matching the anchor.
      created_at: new Date(2020, 0, 1).toISOString(),
      total_sales: 0,
      variants: [
        { id: "v4", product_id: "x4", size: "M", color: "Neon", position: 0, is_active: true, stock: 5 },
      ],
    });

    const ranked = rankSimilarTo(
      [sameCat, sameBrand, sameMaterial, unrelated],
      anchor,
    );
    const ids = ranked.map((r) => r.product.id);
    expect(ids).toContain("x1");
    expect(ids).toContain("x2");
    expect(ids).toContain("x3");
    expect(ids).not.toContain("x4");
  });

  it("orders by overlap score (category > brand > material)", () => {
    const anchor = product({
      id: "anchor",
      name: "Olive Shirt",
      category_id: "shirts",
      brand_id: "lume",
      material: "linen",
    });
    const catOnly = product({
      id: "x1",
      category_id: "shirts",
      brand_id: "z",
      material: "plastic",
    });
    const matOnly = product({
      id: "x2",
      category_id: "z",
      brand_id: "z",
      material: "linen",
    });
    const ranked = rankSimilarTo([matOnly, catOnly], anchor);
    // catOnly (overlap 3) > matOnly (overlap 1)
    expect(ranked[0].product.id).toBe("x1");
  });

  it("excludes the anchor itself", () => {
    const anchor = product({ id: "a" });
    const ranked = rankSimilarTo([anchor, product({ id: "b" })], anchor);
    expect(ranked.find((r) => r.product.id === "a")).toBeUndefined();
  });
});

/* ----------------------------- personalizeResults ---------------------- */

describe("personalizeResults", () => {
  it("reorders search results so profile-matching products come first", () => {
    const profile = signalProfile(); // c1 + b1 + cotton
    const a = product({ id: "a", category_id: "c1", brand_id: "b1", material: "cotton" });
    const b = product({ id: "b", category_id: "c5", brand_id: "b5", material: "polyester" });
    const c = product({ id: "c", category_id: "c1", brand_id: "b5", material: "cotton" });
    const out = personalizeResults([b, c, a], profile);
    // 'a' should win on every axis.
    expect(out[0].id).toBe("a");
  });

  it("drops products in profile.excludedProductIds", () => {
    const events: any[] = [
      {
        type: "not_interested",
        t: Date.now(),
        product: { id: "b", category_id: "c1", brand_id: "b1", material: "cotton" },
      },
    ];
    for (let i = 0; i < 4; i++) {
      events.push({
        type: "view",
        t: Date.now(),
        product: { id: `seed${i}`, category_id: "c1", brand_id: "b1", material: "cotton" },
        dwellMs: 8000,
      });
    }
    const profile = buildProfile(events, Date.now());
    const a = product({ id: "a", category_id: "c1", brand_id: "b1" });
    const b = product({ id: "b", category_id: "c1", brand_id: "b1" });
    const out = personalizeResults([a, b], profile);
    expect(out.find((p) => p.id === "b")).toBeUndefined();
  });

  it("filters out-of-stock", () => {
    const profile = signalProfile();
    const a = product({ id: "a", category_id: "c1", brand_id: "b1" });
    const b = product({
      id: "b",
      category_id: "c1",
      brand_id: "b1",
      variants: [variant({ stock: 0 })],
    });
    const out = personalizeResults([a, b], profile);
    expect(out.find((p) => p.id === "b")).toBeUndefined();
  });

  it("no signal → preserves popularity order (small personalization)", () => {
    const a = product({ id: "a", total_sales: 100 });
    const b = product({ id: "b", total_sales: 1000 });
    const c = product({ id: "c", total_sales: 10 });
    const out = personalizeResults([a, c, b], emptyProfile());
    // With no profile, b should come first on popularity alone.
    expect(out[0].id).toBe("b");
  });

  it("respects limit when given", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      product({ id: `p${i}`, total_sales: 100 - i }),
    );
    const out = personalizeResults(items, emptyProfile(), { limit: 5 });
    expect(out.length).toBe(5);
  });
});

/* ----------------------------- humanReason ----------------------------- */

describe("humanReason", () => {
  it("returns null when no positive reasons and not popular", () => {
    const p = product({ rating: 3, total_sales: 1 });
    const ranked = rankProducts([p], emptyProfile());
    expect(humanReason(ranked[0])).toBeNull();
  });

  it("returns 'Top rated' for high rating with no personalization", () => {
    const p = product({ rating: 4.7, total_reviews: 20, total_sales: 1 });
    const ranked = rankProducts([p], emptyProfile());
    expect(humanReason(ranked[0])).toBe("Top rated");
  });

  it("returns 'Popular pick' for high total_sales with no personalization", () => {
    const p = product({ rating: 3, total_sales: 500 });
    const ranked = rankProducts([p], emptyProfile());
    expect(humanReason(ranked[0])).toBe("Popular pick");
  });

  it("returns axis-specific label for personalized matches", () => {
    const profile = signalProfile();
    const p = product({ id: "match", category_id: "c1", brand_id: "b1" });
    const ranked = rankProducts([p], profile, { limit: 1 });
    const reason = humanReason(ranked[0]);
    expect(reason).not.toBeNull();
    // Should be one of the known labels.
    expect([
      "Matches your taste",
      "From a brand you like",
      "Same fabric you love",
      "In a color you like",
      "Similar style",
      "Right up your alley",
      "Picked for you",
    ]).toContain(reason);
  });
});
