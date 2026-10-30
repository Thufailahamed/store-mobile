import { describe, it, expect } from "vitest";
import { DEFAULT_SIZES, SIZE_PRESETS, sizeSystemFor, sortSizes } from "@/lib/size-presets";

describe("sizeSystemFor", () => {
  it("detects footwear, waist and one-size products", () => {
    expect(sizeSystemFor("Shoes", "Leather Slippers")).toBe("footwear");
    expect(sizeSystemFor("Jeans", "Levis 517")).toBe("waist");
    expect(sizeSystemFor("Bags", "Canvas Tote")).toBe("onesize");
  });

  it("falls back to apparel letters", () => {
    expect(sizeSystemFor("Dresses", "Velvet Gown")).toBe("apparel");
  });
});

describe("size presets", () => {
  it("runs clothing letters up to 5XL", () => {
    expect(SIZE_PRESETS.apparel.at(-1)).toBe("5XL");
  });

  it("keeps every default inside its preset", () => {
    for (const system of Object.keys(SIZE_PRESETS) as (keyof typeof SIZE_PRESETS)[]) {
      expect(DEFAULT_SIZES[system].every((s) => SIZE_PRESETS[system].includes(s))).toBe(true);
    }
  });

  it("orders decimal and EU sizes numerically", () => {
    expect(sortSizes(["15.5", "15", "16"])).toEqual(["15", "15.5", "16"]);
    expect(sortSizes(["EU 40", "EU 39"])).toEqual(["EU 39", "EU 40"]);
  });
});
