import { describe, it, expect } from "vitest";
import { PRICE_BOUNDS, priceFilterFor } from "@/lib/api/facets";

describe("priceFilterFor", () => {
  it("falls back to the full catalogue range when no band is set", () => {
    expect(priceFilterFor(undefined, undefined)).toEqual([PRICE_BOUNDS.min, PRICE_BOUNDS.max]);
  });

  it("maps the Under 5K band", () => {
    expect(priceFilterFor(0, 5000)).toEqual([0, 5000]);
  });

  it("maps the 5K – 15K band", () => {
    expect(priceFilterFor(5000, 15000)).toEqual([5000, 15000]);
  });

  it("maps the 50K+ band to the catalogue maximum", () => {
    expect(priceFilterFor(50000, undefined)).toEqual([50000, PRICE_BOUNDS.max]);
  });

  it("returns a fresh tuple so callers can't mutate the shared default", () => {
    const a = priceFilterFor(undefined, undefined);
    a[0] = 999;
    expect(priceFilterFor(undefined, undefined)[0]).toBe(PRICE_BOUNDS.min);
  });
});
