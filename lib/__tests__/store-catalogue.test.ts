import { describe, expect, it, vi } from "vitest";
import type { Brand, Category, Product } from "@/lib/types";
import {
  EMPTY_STORE_FILTERS,
  activeStoreFilterChips,
  applyStoreCatalogue,
  buildStoreFacets,
  countActiveStoreFilters,
  filterStoreProducts,
  pricePresets,
  sortStoreProducts,
  storeProductHaystack,
  type StoreFilters,
} from "@/lib/store-catalogue";

const category = (id: string, name: string): Category => ({
  id,
  name,
  slug: name.toLowerCase(),
  position: 1,
  is_active: true,
});

const brand = (id: string, name: string): Brand => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  status: "approved",
  rating: 4.5,
  total_followers: 0,
  total_products: 0,
  created_at: "2026-01-01",
});

function product(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? "p1";
  return {
    id,
    store_id: "s1",
    name: "Silk Slip Dress",
    slug: `silk-slip-dress-${id}`,
    sku: "SKU-1",
    product_type: "variable",
    description: "A fluid silk dress for evening.",
    short_description: "Fluid silk.",
    mrp: 12000,
    price: 9000,
    currency: "LKR",
    discount_pct: 25,
    tax_rate: 0,
    status: "active",
    gender: "women",
    material: "Silk",
    pattern: "Solid",
    fit: "Regular",
    occasion: "Evening",
    tags: ["dress", "silk", "evening"],
    attributes: {},
    is_featured: false,
    is_active: true,
    rating: 4.6,
    total_reviews: 120,
    total_sales: 300,
    view_count: 100,
    wishlist_count: 10,
    created_at: "2026-01-10",
    updated_at: "2026-01-10",
    category_id: "c2",
    category: category("c2", "Women"),
    brand: brand("b1", "Zen Wear"),
    variants: [
      { id: `${id}-m-blue`, product_id: id, size: "M", color: "Cobalt Blue", color_hex: "#2563eb", position: 0, is_active: true },
      { id: `${id}-l-black`, product_id: id, size: "L", color: "Black", color_hex: "#000000", position: 1, is_active: true },
    ],
    images: [],
    ...overrides,
  };
}

const filters = (patch: Partial<StoreFilters> = {}): StoreFilters => ({
  ...EMPTY_STORE_FILTERS,
  ...patch,
  categories: patch.categories ?? [],
  genders: patch.genders ?? [],
  sizes: patch.sizes ?? [],
  colors: patch.colors ?? [],
  brands: patch.brands ?? [],
});

describe("store catalogue search", () => {
  const dress = product();
  const shirt = product({
    id: "p2",
    name: "Linen Camp Shirt",
    slug: "linen-camp-shirt",
    price: 5000,
    mrp: 5000,
    discount_pct: 0,
    rating: 4.1,
    total_sales: 100,
    created_at: "2026-02-01",
    tags: ["shirt", "linen", "casual"],
    gender: "men",
    category_id: "c1",
    category: category("c1", "Men"),
    brand: brand("b2", "North Atelier"),
    variants: [
      { id: "p2-m-sand", product_id: "p2", size: "M", color: "Sand", color_hex: "#d9c9a8", position: 0, is_active: true },
    ],
  });

  it("returns everything for an empty query", () => {
    expect(filterStoreProducts([dress, shirt], filters())).toHaveLength(2);
  });

  it("matches name, tags, category, brand, and variant colour", () => {
    expect(filterStoreProducts([dress, shirt], filters({ query: "slip" }))).toEqual([dress]);
    expect(filterStoreProducts([dress, shirt], filters({ query: "evening" }))).toEqual([dress]);
    expect(filterStoreProducts([dress, shirt], filters({ query: "women" }))).toEqual([dress]);
    expect(filterStoreProducts([dress, shirt], filters({ query: "zen" }))).toEqual([dress]);
    expect(filterStoreProducts([dress, shirt], filters({ query: "cobalt" }))).toEqual([dress]);
  });

  it("requires every token to match", () => {
    expect(filterStoreProducts([dress, shirt], filters({ query: "silk blue" }))).toEqual([dress]);
    expect(filterStoreProducts([dress, shirt], filters({ query: "silk pink" }))).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(filterStoreProducts([dress, shirt], filters({ query: "SILK" }))).toEqual([dress]);
  });
});

describe("store catalogue filters", () => {
  const women = product();
  const men = product({
    id: "p2",
    name: "Wool Overshirt",
    slug: "wool-overshirt",
    gender: "men",
    price: 15000,
    mrp: 15000,
    discount_pct: 0,
    rating: 3.9,
    category_id: "c1",
    category: category("c1", "Men"),
    brand: brand("b2", "North Atelier"),
    tags: ["shirt", "wool"],
    variants: [
      { id: "p2-xl-grey", product_id: "p2", size: "XL", color: "Charcoal", color_hex: "#333333", position: 0, is_active: true },
    ],
  });

  it("filters by category, gender, size, colour, and brand", () => {
    expect(filterStoreProducts([women, men], filters({ categories: ["Women"] }))).toEqual([women]);
    expect(filterStoreProducts([women, men], filters({ genders: ["men"] }))).toEqual([men]);
    expect(filterStoreProducts([women, men], filters({ sizes: ["XL"] }))).toEqual([men]);
    expect(filterStoreProducts([women, men], filters({ colors: ["blue"] }))).toEqual([women]);
    expect(filterStoreProducts([women, men], filters({ brands: ["North Atelier"] }))).toEqual([men]);
  });

  it("filters by sale, rating, and price", () => {
    expect(filterStoreProducts([women, men], filters({ onSale: true }))).toEqual([women]);
    expect(filterStoreProducts([women, men], filters({ minRating: 4 }))).toEqual([women]);
    expect(filterStoreProducts([women, men], filters({ price: [0, 10000] }))).toEqual([women]);
    expect(filterStoreProducts([women, men], filters({ price: [10000, 20000] }))).toEqual([men]);
  });

  it("combines filters", () => {
    expect(
      filterStoreProducts(
        [women, men],
        filters({ genders: ["women"], colors: ["blue"], sizes: ["M"], minRating: 4 }),
      ),
    ).toEqual([women]);
  });
});

describe("store catalogue sorting", () => {
  const a = product({ id: "a", name: "A", price: 3000, rating: 4.2, total_sales: 10, created_at: "2026-01-01", mrp: 6000, discount_pct: 50 });
  const b = product({ id: "b", name: "B", price: 1000, rating: 4.8, total_sales: 90, created_at: "2026-03-01", mrp: 1000, discount_pct: 0 });
  const c = product({ id: "c", name: "C", price: 2000, rating: 4.5, total_sales: 50, created_at: "2026-02-01", mrp: 2500, discount_pct: 20 });

  it("sorts by newest, price, rating, discount, and sales", () => {
    expect(sortStoreProducts([a, b, c], "newest").map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(sortStoreProducts([a, b, c], "price-asc").map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(sortStoreProducts([a, b, c], "price-desc").map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(sortStoreProducts([a, b, c], "rating").map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(sortStoreProducts([a, b, c], "discount").map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(sortStoreProducts([a, b, c], "best-selling").map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("preserves order for curated", () => {
    expect(sortStoreProducts([c, a, b], "curated").map((p) => p.id)).toEqual(["c", "a", "b"]);
  });
});

describe("store catalogue facets", () => {
  const women = product();
  const men = product({
    id: "p2",
    name: "Wool Overshirt",
    slug: "wool-overshirt",
    gender: "men",
    price: 15000,
    mrp: 15000,
    discount_pct: 0,
    rating: 3.9,
    category_id: "c1",
    category: category("c1", "Men"),
    brand: brand("b2", "North Atelier"),
    tags: ["shirt", "wool"],
    variants: [
      { id: "p2-xl-grey", product_id: "p2", size: "XL", color: "Charcoal", color_hex: "#333333", position: 0, is_active: true },
    ],
  });

  it("counts facets and derives real price bounds", () => {
    const facets = buildStoreFacets([women, men]);
    expect(facets.categories).toEqual([
      { value: "Men", label: "Men", count: 1 },
      { value: "Women", label: "Women", count: 1 },
    ]);
    expect(facets.genders.map((g) => g.value).sort()).toEqual(["men", "women"]);
    expect(facets.sizes.map((s) => s.value).sort()).toEqual(["L", "M", "XL"]);
    expect(facets.colors.map((c) => c.value).sort()).toEqual(["black", "blue", "grey"]);
    expect(facets.brands.map((b) => b.value).sort()).toEqual(["North Atelier", "Zen Wear"]);
    expect(facets.price.min).toBe(9000);
    expect(facets.price.max).toBe(15000);
    expect(facets.onSaleCount).toBe(1);
    expect(facets.ratedCount).toBe(1);
  });

  it("counts active filters and builds clearable chips", () => {
    const active = filters({
      query: "silk",
      categories: ["Women"],
      sizes: ["M"],
      colors: ["blue"],
      price: [1000, 9000],
      onSale: true,
      minRating: 4,
    });
    expect(countActiveStoreFilters(active)).toBe(6);

    const facets = buildStoreFacets([women, men]);
    const onChange = vi.fn();
    const chips = activeStoreFilterChips(active, facets, onChange);
    expect(chips.map((c) => c.label)).toEqual([
      "Women",
      "M",
      "Blue",
      "4★ & up",
      "On sale",
      "LKR 1,000 – LKR 9,000",
    ]);

    chips[0].clear();
    expect(onChange).toHaveBeenCalledWith({ ...active, categories: [] });
  });

  it("builds price presets inside the real bounds", () => {
    const presets = pricePresets({ min: 5000, max: 15000 }, "LKR");
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0].range[0]).toBe(5000);
    expect(presets[presets.length - 1].range[1]).toBe(15000);
  });

  it("builds a searchable haystack", () => {
    const haystack = storeProductHaystack(women);
    expect(haystack).toContain("silk slip dress");
    expect(haystack).toContain("women");
    expect(haystack).toContain("cobalt blue");
    expect(haystack).toContain("zen wear");
  });
});

describe("applyStoreCatalogue", () => {
  it("filters then sorts", () => {
    const a = product({ id: "a", name: "Silk A", price: 3000 });
    const b = product({ id: "b", name: "Silk B", price: 1000 });
    const c = product({ id: "c", name: "Linen C", price: 2000, tags: ["linen"] });
    const result = applyStoreCatalogue([a, b, c], filters({ query: "silk" }), "price-asc");
    expect(result.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
