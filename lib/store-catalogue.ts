// =============================================================================
// Store catalogue engine — pure, DOM-free filtering for a single storefront
// =============================================================================
// Mirror of the web engine (store/src/lib/store-catalogue.ts); keep the two in
// sync. The mobile store screen hands the store's full `Product[]` to this
// module. Facets, search, filters, sort, active chips,
// and price presets all live here so the UI stays a thin presentation layer
// and the behaviour is testable without a browser.
//
// Search is token-AND: every token must appear somewhere in the product's
// haystack (name, SKU, gender, category, brand, tags, variant size/colour/SKU).
// Colour filtering goes through `colorFamilies` so free-text seller shades
// ("Cobalt Blue", "Charcoal") map onto shopper-facing families.
// =============================================================================

import type { Product } from "@/lib/types";
import { COLOR_FAMILIES, colorFamilies } from "@/lib/facet-vocab";
import { discountPct, formatPrice } from "@/lib/utils";

export type StoreSort =
  | "curated"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "discount"
  | "best-selling";

export interface StoreFilters {
  query: string;
  categories: string[];
  genders: string[];
  sizes: string[];
  colors: string[];
  brands: string[];
  price: [number, number] | null;
  onSale: boolean;
  minRating: number;
}

export const EMPTY_STORE_FILTERS: StoreFilters = {
  query: "",
  categories: [],
  genders: [],
  sizes: [],
  colors: [],
  brands: [],
  price: null,
  onSale: false,
  minRating: 0,
};

export const STORE_SORTS: { value: StoreSort; label: string }[] = [
  { value: "curated", label: "Curated" },
  { value: "newest", label: "New in" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
  { value: "best-selling", label: "Best selling" },
];

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export interface ColorFacet extends FacetCount {
  hex: string;
}

export interface StoreFacets {
  categories: FacetCount[];
  genders: FacetCount[];
  sizes: FacetCount[];
  colors: ColorFacet[];
  brands: FacetCount[];
  price: { min: number; max: number };
  onSaleCount: number;
  ratedCount: number;
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hasDiscount(product: Product): boolean {
  if (typeof product.discount_pct === "number" && product.discount_pct > 0) return true;
  return typeof product.mrp === "number" && product.mrp > product.price;
}

function productDiscount(product: Product): number {
  const computed = discountPct(product.mrp, product.price);
  return Math.max(computed, product.discount_pct ?? 0);
}

function activeVariants(product: Product) {
  return (product.variants ?? []).filter((variant) => variant.is_active !== false);
}

function productColors(product: Product): string[] {
  const families = new Set<string>();
  for (const variant of activeVariants(product)) {
    for (const family of colorFamilies(variant.color)) families.add(family);
  }
  return [...families];
}

function timeValue(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function money(value: number, currency: string): string {
  return formatPrice(value, currency).replace(/[\u00a0\u202f]/g, " ");
}

function searchTokens(query: string): string[] {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

/** Lower-cased text blob used by store search. */
export function storeProductHaystack(product: Product): string {
  const parts: Array<string | number | null | undefined> = [
    product.name,
    product.sku,
    product.gender,
    product.category?.name,
    product.category?.slug,
    product.brand?.name,
    product.brand?.slug,
    ...(product.tags ?? []),
  ];

  for (const variant of product.variants ?? []) {
    parts.push(variant.size, variant.color, variant.sku);
  }

  for (const value of Object.values(product.attributes ?? {})) {
    if (typeof value === "string" || typeof value === "number") parts.push(value);
  }

  return parts.filter((part) => part !== null && part !== undefined && `${part}`.trim() !== "").join(" ").toLowerCase();
}

function matchesQuery(product: Product, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const haystack = storeProductHaystack(product);
  return tokens.every((token) => haystack.includes(token));
}

/* ------------------------------------------------------------------ */
/*  Facets                                                             */
/* ------------------------------------------------------------------ */

interface FacetBucket {
  label: string;
  count: number;
}

function bump(map: Map<string, FacetBucket>, value: string, label: string) {
  const existing = map.get(value);
  if (existing) existing.count += 1;
  else map.set(value, { label, count: 1 });
}

function toFacetCounts(map: Map<string, FacetBucket>): FacetCount[] {
  return [...map.entries()]
    .map(([value, bucket]) => ({ value, label: bucket.label, count: bucket.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Facet values + counts derived from the store's full product list. */
export function buildStoreFacets(products: Product[]): StoreFacets {
  const categories = new Map<string, FacetBucket>();
  const genders = new Map<string, FacetBucket>();
  const sizes = new Map<string, FacetBucket>();
  const colors = new Map<string, FacetBucket>();
  const brands = new Map<string, FacetBucket>();

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let onSaleCount = 0;
  let ratedCount = 0;

  for (const product of products) {
    if (typeof product.price === "number" && Number.isFinite(product.price)) {
      min = Math.min(min, product.price);
      max = Math.max(max, product.price);
    }

    if (hasDiscount(product)) onSaleCount += 1;
    if ((product.rating ?? 0) >= 4) ratedCount += 1;

    if (product.category?.name) {
      bump(categories, product.category.name, product.category.name);
    }

    if (product.gender) {
      bump(genders, product.gender, titleCase(product.gender));
    }

    if (product.brand?.name) {
      bump(brands, product.brand.name, product.brand.name);
    }

    const seenSizes = new Set<string>();
    for (const variant of activeVariants(product)) {
      const size = (variant.size ?? "").trim();
      if (!size) continue;
      const key = size.toUpperCase();
      if (seenSizes.has(key)) continue;
      seenSizes.add(key);
      bump(sizes, size, size);
    }

    for (const family of productColors(product)) {
      bump(colors, family, COLOR_FAMILIES.find((f) => f.key === family)?.label ?? titleCase(family));
    }
  }

  const colorFacets: ColorFacet[] = [...colors.entries()]
    .map(([value, bucket]) => ({
      value,
      label: bucket.label,
      count: bucket.count,
      hex: COLOR_FAMILIES.find((f) => f.key === value)?.hex ?? "#7a7a72",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    categories: toFacetCounts(categories),
    genders: toFacetCounts(genders),
    sizes: toFacetCounts(sizes),
    colors: colorFacets,
    brands: toFacetCounts(brands),
    price: {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
    },
    onSaleCount,
    ratedCount,
  };
}

/* ------------------------------------------------------------------ */
/*  Filtering                                                          */
/* ------------------------------------------------------------------ */

function matchesAny(value: string | null | undefined, selected: string[]): boolean {
  if (!selected.length) return true;
  const target = normalize(value);
  if (!target) return false;
  return selected.some((entry) => normalize(entry) === target);
}

function matchesCategory(product: Product, selected: string[]): boolean {
  if (!selected.length) return true;
  const candidates = [
    product.category?.name,
    product.category?.slug,
    product.category_id,
  ];
  return candidates.some((candidate) => matchesAny(candidate, selected));
}

function matchesBrand(product: Product, selected: string[]): boolean {
  if (!selected.length) return true;
  const candidates = [product.brand?.name, product.brand?.slug, product.brand_id];
  return candidates.some((candidate) => matchesAny(candidate, selected));
}

function matchesSize(product: Product, selected: string[]): boolean {
  if (!selected.length) return true;
  return activeVariants(product).some((variant) => matchesAny(variant.size, selected));
}

function matchesColor(product: Product, selected: string[]): boolean {
  if (!selected.length) return true;
  const families = productColors(product);
  return selected.some((entry) => families.includes(normalize(entry)));
}

/** All active filters applied; input order is preserved. */
export function filterStoreProducts(products: Product[], filters: StoreFilters): Product[] {
  const tokens = searchTokens(filters.query);

  return products.filter((product) => {
    if (!matchesQuery(product, tokens)) return false;
    if (!matchesCategory(product, filters.categories)) return false;
    if (!matchesAny(product.gender, filters.genders)) return false;
    if (!matchesSize(product, filters.sizes)) return false;
    if (!matchesColor(product, filters.colors)) return false;
    if (!matchesBrand(product, filters.brands)) return false;
    if (filters.onSale && !hasDiscount(product)) return false;
    if (filters.minRating > 0 && (product.rating ?? 0) < filters.minRating) return false;
    if (filters.price) {
      const [low, high] = filters.price;
      if (product.price < low || product.price > high) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Sorting                                                            */
/* ------------------------------------------------------------------ */

/** Stable sort over a copy of the list. `curated` keeps the incoming order. */
export function sortStoreProducts(products: Product[], sort: StoreSort): Product[] {
  if (sort === "curated") return [...products];

  const indexed = products.map((product, index) => ({ product, index }));
  const compare = (a: Product, b: Product): number => {
    switch (sort) {
      case "newest":
        return timeValue(b.created_at) - timeValue(a.created_at);
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "discount":
        return productDiscount(b) - productDiscount(a);
      case "best-selling":
        return (b.total_sales ?? 0) - (a.total_sales ?? 0);
      default:
        return 0;
    }
  };

  indexed.sort((a, b) => compare(a.product, b.product) || a.index - b.index);
  return indexed.map((entry) => entry.product);
}

/** Filter then sort — the one call the shelf needs. */
export function applyStoreCatalogue(
  products: Product[],
  filters: StoreFilters,
  sort: StoreSort,
): Product[] {
  return sortStoreProducts(filterStoreProducts(products, filters), sort);
}

/* ------------------------------------------------------------------ */
/*  Active filter chips                                                */
/* ------------------------------------------------------------------ */

export interface ActiveStoreFilterChip {
  key: string;
  label: string;
  clear: () => void;
}

function facetLabel(facets: FacetCount[], value: string): string {
  return facets.find((facet) => normalize(facet.value) === normalize(value))?.label ?? value;
}

/** Number of active facet selections (search text has its own field). */
export function countActiveStoreFilters(filters: StoreFilters): number {
  return (
    filters.categories.length +
    filters.genders.length +
    filters.sizes.length +
    filters.colors.length +
    filters.brands.length +
    (filters.price ? 1 : 0) +
    (filters.onSale ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0)
  );
}

/**
 * Clearable chips mirroring the current filters. `onChange` receives the next
 * full filter object so callers can keep one state setter.
 */
export function activeStoreFilterChips(
  filters: StoreFilters,
  facets: StoreFacets,
  onChange: (next: StoreFilters) => void,
  currency = "LKR",
): ActiveStoreFilterChip[] {
  const chips: ActiveStoreFilterChip[] = [];

  for (const value of filters.categories) {
    chips.push({
      key: `category-${value}`,
      label: facetLabel(facets.categories, value),
      clear: () =>
        onChange({ ...filters, categories: filters.categories.filter((entry) => entry !== value) }),
    });
  }

  for (const value of filters.genders) {
    chips.push({
      key: `gender-${value}`,
      label: facetLabel(facets.genders, value),
      clear: () =>
        onChange({ ...filters, genders: filters.genders.filter((entry) => entry !== value) }),
    });
  }

  for (const value of filters.sizes) {
    chips.push({
      key: `size-${value}`,
      label: facetLabel(facets.sizes, value),
      clear: () => onChange({ ...filters, sizes: filters.sizes.filter((entry) => entry !== value) }),
    });
  }

  for (const value of filters.colors) {
    chips.push({
      key: `color-${value}`,
      label: facetLabel(facets.colors, value),
      clear: () =>
        onChange({ ...filters, colors: filters.colors.filter((entry) => entry !== value) }),
    });
  }

  for (const value of filters.brands) {
    chips.push({
      key: `brand-${value}`,
      label: facetLabel(facets.brands, value),
      clear: () =>
        onChange({ ...filters, brands: filters.brands.filter((entry) => entry !== value) }),
    });
  }

  if (filters.minRating > 0) {
    chips.push({
      key: `rating-${filters.minRating}`,
      label: `${filters.minRating}★ & up`,
      clear: () => onChange({ ...filters, minRating: 0 }),
    });
  }

  if (filters.onSale) {
    chips.push({
      key: "on-sale",
      label: "On sale",
      clear: () => onChange({ ...filters, onSale: false }),
    });
  }

  if (filters.price) {
    const [low, high] = filters.price;
    chips.push({
      key: `price-${low}-${high}`,
      label: `${money(low, currency)} – ${money(high, currency)}`,
      clear: () => onChange({ ...filters, price: null }),
    });
  }

  return chips;
}

/* ------------------------------------------------------------------ */
/*  Price presets                                                      */
/* ------------------------------------------------------------------ */

export interface StorePricePreset {
  label: string;
  range: [number, number];
}

function roundBoundary(value: number, span: number): number {
  if (span >= 10_000) return Math.round(value / 1_000) * 1_000;
  if (span >= 1_000) return Math.round(value / 100) * 100;
  if (span >= 100) return Math.round(value / 10) * 10;
  return Math.round(value);
}

/**
 * Four "good enough" price buckets spanning the store's real bounds. The
 * first bucket starts at `bounds.min` and the last ends at `bounds.max`, so
 * the UI never hides products outside the slider range.
 */
export function pricePresets(
  bounds: { min: number; max: number },
  currency: string,
): StorePricePreset[] {
  const min = Math.max(0, Math.floor(bounds.min));
  const max = Math.max(min, Math.ceil(bounds.max));
  const span = max - min;

  if (span <= 0) {
    return [{ label: `Up to ${money(max, currency)}`, range: [min, max] }];
  }

  const cuts = [min];
  for (let i = 1; i < 4; i += 1) {
    cuts.push(roundBoundary(min + (span * i) / 4, span));
  }
  cuts.push(max);

  const unique = [...new Set(cuts)].filter((value) => value >= min && value <= max).sort((a, b) => a - b);
  const presets: StorePricePreset[] = [];

  for (let i = 0; i < unique.length - 1; i += 1) {
    const low = unique[i];
    const high = unique[i + 1];
    const isFirst = i === 0;
    const isLast = i === unique.length - 2;
    const label = isFirst
      ? `Up to ${money(high, currency)}`
      : isLast
        ? `${money(low, currency)} & up`
        : `${money(low, currency)} – ${money(high, currency)}`;
    presets.push({ label, range: [low, high] });
  }

  return presets.length
    ? presets
    : [{ label: `Up to ${money(max, currency)}`, range: [min, max] }];
}
