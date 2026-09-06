import { describe, it, expect } from "vitest";
import { discountPct, percentToTaxRate, taxRateToPercent } from "@/lib/utils";

describe("discountPct", () => {
  it("derives percent off from MRP and selling price", () => {
    expect(discountPct(92000, 82000)).toBe(11);
    expect(discountPct(100, 100)).toBe(0);
    expect(discountPct(0, 50)).toBe(0);
  });
});

describe("tax rate display", () => {
  it("shows stored fractions as percents", () => {
    expect(taxRateToPercent(0.15)).toBe(15);
    expect(taxRateToPercent(0)).toBe(0);
  });

  it("passes through legacy percent values already stored above 1", () => {
    expect(taxRateToPercent(18)).toBe(18);
  });

  it("saves percent input as a 0–1 fraction and clamps to 100%", () => {
    expect(percentToTaxRate(15)).toBe(0.15);
    expect(percentToTaxRate(0)).toBe(0);
    expect(percentToTaxRate(150)).toBe(1);
  });
});
