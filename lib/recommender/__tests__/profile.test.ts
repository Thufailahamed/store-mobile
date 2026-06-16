/**
 * Profile unit tests.
 *
 * Pure functions only — no AsyncStorage, no supabase. Validates:
 *   - decayedWeight: 14-day half-life decay
 *   - buildProfile: aggregation across event types
 *   - signal threshold (>= 3 events)
 *   - excludedProductIds for dismiss/not_interested
 *   - price center computation
 */

import { describe, it, expect } from "vitest";
import {
  buildProfile,
  decayedWeight,
  profilePriceCenter,
  EMPTY_PROFILE,
  type UserProfile,
} from "../profile";
import type {
  RecommendationEvent,
  TrackedProduct,
} from "../events";

const NOW = 1_700_000_000_000; // fixed epoch for determinism
const ONE_DAY = 24 * 60 * 60 * 1000;

function tp(over: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id: "p1",
    category_id: "c-shoes",
    brand_id: "b-nike",
    store_id: "s-store1",
    tags: ["sneaker", "running"],
    material: "mesh",
    gender: "unisex",
    price: 120,
    colors: ["black", "white"],
    garment: "sneakers",
    ...over,
  };
}

function view(p: TrackedProduct, dwellMs = 5000, t = NOW): RecommendationEvent {
  return { type: "view", t, product: p, dwellMs };
}
function wishlist(p: TrackedProduct, t = NOW): RecommendationEvent {
  return { type: "wishlist_add", t, product: p };
}
function cart(p: TrackedProduct, t = NOW): RecommendationEvent {
  return { type: "cart_add", t, product: p };
}
function purchase(p: TrackedProduct, t = NOW): RecommendationEvent {
  return { type: "purchase", t, product: p, quantity: 1 };
}
function dismiss(p: TrackedProduct, t = NOW): RecommendationEvent {
  return { type: "dismiss", t, product: p };
}
function notInterested(p: TrackedProduct, t = NOW): RecommendationEvent {
  return { type: "not_interested", t, product: p };
}
function search(query: string, tokens: string[], t = NOW): RecommendationEvent {
  return { type: "search", t, query, tokens, resultCount: 12 };
}

describe("decayedWeight", () => {
  it("returns full weight for fresh events", () => {
    expect(decayedWeight(10, NOW, NOW)).toBeCloseTo(10, 6);
  });

  it("halves weight after one half-life (14 days)", () => {
    expect(decayedWeight(10, NOW - 14 * ONE_DAY, NOW)).toBeCloseTo(5, 6);
  });

  it("quarters weight after two half-lives (28 days)", () => {
    expect(decayedWeight(10, NOW - 28 * ONE_DAY, NOW)).toBeCloseTo(2.5, 6);
  });

  it("clamps negative age to zero (future events)", () => {
    expect(decayedWeight(10, NOW + 1000, NOW)).toBeCloseTo(10, 6);
  });
});

describe("buildProfile — basic aggregation", () => {
  it("returns EMPTY_PROFILE shape for no events", () => {
    const p = buildProfile([], NOW);
    expect(p.eventCount).toBe(0);
    expect(p.hasSignal).toBe(false);
    expect(p.lastEventAt).toBe(0);
    expect(p.categories).toEqual({});
  });

  it("aggregates categories, brands, materials from view events", () => {
    const p1 = tp({ id: "a", category_id: "c-shoes", brand_id: "b-nike" });
    const p2 = tp({ id: "b", category_id: "c-shoes", brand_id: "b-adidas" });
    const p = buildProfile([view(p1), view(p2)], NOW);
    expect(p.categories["c-shoes"]).toBeGreaterThan(0);
    expect(p.brands["b-nike"]).toBeGreaterThan(0);
    expect(p.brands["b-adidas"]).toBeGreaterThan(0);
  });

  it("purchase weight > view weight on same axis", () => {
    const p1 = tp({ id: "a" });
    const profileView = buildProfile([view(p1, 0)], NOW);
    const profileBuy = buildProfile([purchase(p1)], NOW);
    expect(profileBuy.brands["b-nike"]).toBeGreaterThan(profileView.brands["b-nike"]);
  });

  it("wishlist_remove produces negative signal", () => {
    const p1 = tp({ id: "a" });
    const ev: RecommendationEvent = { type: "wishlist_remove", t: NOW, product: p1 };
    const p = buildProfile([ev], NOW);
    expect(p.brands["b-nike"]).toBeLessThan(0);
  });
});

describe("buildProfile — signal threshold", () => {
  it("needs 3+ events to mark hasSignal", () => {
    const p1 = tp({ id: "a" });
    expect(buildProfile([], NOW).hasSignal).toBe(false);
    expect(buildProfile([view(p1)], NOW).hasSignal).toBe(false);
    expect(buildProfile([view(p1), view(p1)], NOW).hasSignal).toBe(false);
    expect(buildProfile([view(p1), view(p1), view(p1)], NOW).hasSignal).toBe(true);
  });
});

describe("buildProfile — excluded products", () => {
  it("dismiss adds product to excludedProductIds", () => {
    const p1 = tp({ id: "a" });
    const p2 = tp({ id: "b" });
    const p = buildProfile([dismiss(p1), view(p2)], NOW);
    expect(p.excludedProductIds).toContain("a");
    expect(p.excludedProductIds).not.toContain("b");
  });

  it("not_interested adds to excludedProductIds with stronger negative", () => {
    const p1 = tp({ id: "a" });
    const p = buildProfile([notInterested(p1)], NOW);
    expect(p.excludedProductIds).toContain("a");
    // Strong negative weight
    expect(p.brands["b-nike"]).toBeLessThan(0);
  });

  it("caps excludedProductIds at 200", () => {
    const events: RecommendationEvent[] = [];
    for (let i = 0; i < 250; i++) {
      events.push(dismiss(tp({ id: `p${i}` })));
    }
    const p = buildProfile(events, NOW);
    expect(p.excludedProductIds.length).toBe(200);
  });
});

describe("buildProfile — price center", () => {
  it("weights price by event weight (purchase > view)", () => {
    const cheap = tp({ id: "a", price: 50 });
    const pricey = tp({ id: "b", price: 200 });
    const events: RecommendationEvent[] = [
      view(cheap),
      view(cheap),
      view(cheap),
      view(pricey),
    ];
    const p = buildProfile(events, NOW);
    // Center should be nearer the cheap price since more views.
    const center = profilePriceCenter(p);
    expect(center).toBeLessThan(125);
  });

  it("skips non-positive signal events for price center", () => {
    const cheap = tp({ id: "a", price: 50 });
    const expensive = tp({ id: "b", price: 1000 });
    const events: RecommendationEvent[] = [
      view(cheap),
      { type: "wishlist_remove", t: NOW, product: expensive },
    ];
    const p = buildProfile(events, NOW);
    const center = profilePriceCenter(p);
    expect(center).toBe(50);
  });

  it("returns 0 when no positive price signals", () => {
    const p = buildProfile([], NOW);
    expect(profilePriceCenter(p)).toBe(0);
  });
});

describe("buildProfile — search events", () => {
  it("spreads weight across tag/garment/material axes", () => {
    const events: RecommendationEvent[] = [
      search("leather jacket", ["leather", "jacket"]),
    ];
    const p = buildProfile(events, NOW);
    // Each token bumps tag, garment, material.
    expect(p.tags["leather"]).toBeGreaterThan(0);
    expect(p.tags["jacket"]).toBeGreaterThan(0);
    expect(p.garments["jacket"]).toBeGreaterThan(0);
    expect(p.materials["leather"]).toBeGreaterThan(0);
  });

  it("filters tokens shorter than 3 chars", () => {
    const p = buildProfile(
      [search("a b leather", ["a", "b", "leather"])],
      NOW,
    );
    expect(p.tags["a"]).toBeUndefined();
    expect(p.tags["b"]).toBeUndefined();
    expect(p.tags["leather"]).toBeGreaterThan(0);
  });
});

describe("buildProfile — recentProductIds", () => {
  it("tracks unique ids, most recent first, capped at 50", () => {
    const events: RecommendationEvent[] = [];
    for (let i = 0; i < 60; i++) {
      events.push(view(tp({ id: `p${i}` })));
    }
    const p = buildProfile(events, NOW);
    expect(p.recentProductIds.length).toBe(50);
    // Most recent first → highest id at the head.
    expect(p.recentProductIds[0]).toBe("p59");
  });
});

describe("buildProfile — time decay applies", () => {
  it("older events contribute less than newer events", () => {
    const p1 = tp({ id: "a" });
    const fresh = buildProfile([view(p1, 0, NOW)], NOW);
    const old = buildProfile([view(p1, 0, NOW - 60 * ONE_DAY)], NOW);
    expect(fresh.brands["b-nike"]).toBeGreaterThan(old.brands["b-nike"]);
  });
});

describe("EMPTY_PROFILE", () => {
  it("is immutable in shape (all axes empty)", () => {
    expect(EMPTY_PROFILE.hasSignal).toBe(false);
    expect(EMPTY_PROFILE.eventCount).toBe(0);
    for (const key of ["categories", "brands", "materials", "colors", "garments", "tags", "genders"] as const) {
      expect(EMPTY_PROFILE[key]).toEqual({});
    }
  });

  it("recentProductIds and excludedProductIds are not mutated by buildProfile", () => {
    // Seed a profile that pushes ids into both arrays.
    const p1 = tp({ id: "x" });
    buildProfile([
      view(p1),
      view(p1),
      view(p1),
      notInterested(p1),
    ], NOW);
    // EMPTY_PROFILE must remain pristine so subsequent calls see [].
    expect(EMPTY_PROFILE.recentProductIds).toEqual([]);
    expect(EMPTY_PROFILE.excludedProductIds).toEqual([]);
  });

  it("consecutive buildProfile calls are independent", () => {
    const p1 = tp({ id: "a" });
    const p2 = tp({ id: "b" });
    const first = buildProfile([view(p1), view(p1), view(p1)], NOW);
    const second = buildProfile([view(p2), view(p2), view(p2)], NOW);
    expect(first.recentProductIds).toContain("a");
    expect(first.recentProductIds).not.toContain("b");
    expect(second.recentProductIds).toContain("b");
    expect(second.recentProductIds).not.toContain("a");
  });
});
