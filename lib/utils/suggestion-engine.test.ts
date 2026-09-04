import { describe, it, expect } from "vitest";
import {
  getFashionKeywordCompletions,
  getDepartmentIntentChips,
  matchCategories,
  matchBrands,
} from "@/lib/search/suggestion-engine";

describe("suggestion-engine", () => {
  describe("getFashionKeywordCompletions", () => {
    it("returns empty array for empty query", () => {
      expect(getFashionKeywordCompletions("")).toEqual([]);
      expect(getFashionKeywordCompletions("   ")).toEqual([]);
    });

    it("returns completions matching 'shirt'", () => {
      const results = getFashionKeywordCompletions("shirt");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.label === "Shirt")).toBe(true);
      expect(results.some((r) => r.label.toLowerCase().includes("shirt"))).toBe(true);
      expect(results[0].kind).toBe("keyword");
    });

    it("returns completions matching 'dress'", () => {
      const results = getFashionKeywordCompletions("dress");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.label.toLowerCase().includes("dress"))).toBe(true);
    });

    it("handles partial prefix matching like 'lin'", () => {
      const results = getFashionKeywordCompletions("lin");
      expect(results.some((r) => r.label.toLowerCase().includes("linen"))).toBe(true);
    });
  });

  describe("getDepartmentIntentChips", () => {
    it("returns empty array for 1-char query", () => {
      expect(getDepartmentIntentChips("s")).toEqual([]);
    });

    it("returns garment intent chips for 'shirt'", () => {
      const chips = getDepartmentIntentChips("shirt");
      expect(chips.length).toBeGreaterThanOrEqual(3);
      expect(chips.some((c) => c.label.includes("Men's"))).toBe(true);
      expect(chips.some((c) => c.label.includes("Women's"))).toBe(true);
    });

    it("returns department chips for non-garments like 'linen'", () => {
      const chips = getDepartmentIntentChips("linen");
      expect(chips.length).toBeGreaterThan(0);
      expect(chips.some((c) => c.label.includes("Women's") || c.label.includes("Men's"))).toBe(true);
    });
  });

  describe("matchCategories", () => {
    const cats = [
      { id: "1", name: "Shirts", slug: "shirts" },
      { id: "2", name: "T-Shirts & Tops", slug: "t-shirts" },
      { id: "3", name: "Dresses", slug: "dresses" },
    ];

    it("matches categories by query", () => {
      const res = matchCategories("shirt", cats);
      expect(res.length).toBe(2);
      expect(res[0].kind).toBe("category");
      expect(res[0].label).toBe("Shirts");
    });
  });

  describe("matchBrands", () => {
    const brands = [
      { id: "b1", name: "Ralph Lauren", slug: "ralph-lauren", followers: 5000, is_verified: true },
      { id: "b2", name: "Zara", slug: "zara" },
    ];

    it("matches brand by query", () => {
      const res = matchBrands("ralph", brands);
      expect(res.length).toBe(1);
      expect(res[0].kind).toBe("brand");
      expect(res[0].label).toBe("Ralph Lauren");
      expect(res[0].followers).toBe(5000);
      expect(res[0].is_verified).toBe(true);
    });
  });
});
