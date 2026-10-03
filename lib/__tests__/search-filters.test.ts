import { describe, it, expect } from "vitest";
import { applySearchFilters } from "@/lib/search-filters";
import { EMPTY_FILTERS, type ProductFilters } from "@/lib/api/facets";
import type { Product } from "@/lib/types";

function p(id: string, attrs?: { material?: string | null; occasion?: string | null }): Product {
  return {
    id, store_id: "s", name: `P ${id}`, slug: id, product_type: "simple",
    mrp: 1000, price: 800, currency: "LKR", discount_pct: 0, tax_rate: 0,
    status: "active", tags: [], is_featured: false, is_active: true,
    rating: 0, total_reviews: 0, total_sales: 0, view_count: 0, wishlist_count: 0,
    created_at: new Date().toISOString(),
    ai_attrs: attrs,
  } as unknown as Product;
}

const base: ProductFilters = { ...EMPTY_FILTERS };

describe("applySearchFilters — attr facets", () => {
  it("occasion=party keeps only party products", () => {
    const items = [
      p("a", { occasion: "party", material: "velvet" }),
      p("b", { occasion: "casual" }),
      p("c"),
    ];
    const out = applySearchFilters(items, { ...base, occasion: "party" });
    expect(out.map((x) => x.id)).toEqual(["a"]);
  });
  it("material match is case-insensitive", () => {
    const items = [p("a", { material: "Silk" })];
    expect(applySearchFilters(items, { ...base, material: "silk" }).length).toBe(1);
  });
  it("no facet → no-attr products stay", () => {
    const items = [p("a"), p("b", { occasion: "party" })];
    expect(applySearchFilters(items, base).length).toBe(2);
  });
  it("occasion + material compose as AND", () => {
    const items = [
      p("a", { occasion: "party", material: "Velvet" }),
      p("b", { occasion: "party", material: "Silk" }),
    ];
    const out = applySearchFilters(items, { ...base, occasion: "party", material: "velvet" });
    expect(out.map((x) => x.id)).toEqual(["a"]);
  });
});
