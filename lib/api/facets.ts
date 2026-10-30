/**
 * Shared facet constants for the search/filter UI.
 * Mirrors `store/src/components/search/facet-data.ts` but RN-native.
 */

import { COLOR_FAMILIES, OCCASIONS as OCCASION_OPTS, MATERIALS as MATERIAL_OPTS } from "@/lib/facet-vocab";

export interface FacetColor {
  /** Canonical family key — the value stored in `filters.colors`. */
  key: string;
  name: string;
  hex: string;
  /** Light swatch → needs a border + dark checkmark. */
  light: boolean;
}

/**
 * Colour *families* — variant colours are free text ("Cobalt Blue"), so
 * filtering matches on `colorFamilies()` from `@/lib/facet-vocab`.
 * RN can't paint CSS gradients, so "Multi" gets a flat swatch.
 */
export const COLORS: FacetColor[] = COLOR_FAMILIES.map((f) => ({
  key: f.key,
  name: f.label,
  hex: f.hex.startsWith("#") ? f.hex : "#a78bfa",
  light: ["white", "beige", "silver", "yellow"].includes(f.key),
}));

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const DISCOUNTS = [
  { label: "10% & above", min: 10 },
  { label: "25% & above", min: 25 },
  { label: "50% & above", min: 50 },
  { label: "70% & above", min: 70 },
] as const;

export const PRICE_BOUNDS = { min: 0, max: 500000 } as const;

export const PRICE_PRESETS: { label: string; range: [number, number] }[] = [
  { label: "Under 5K", range: [0, 5000] },
  { label: "5K – 15K", range: [5000, 15000] },
  { label: "15K – 50K", range: [15000, 50000] },
  { label: "50K+", range: [50000, PRICE_BOUNDS.max] },
];

/* ------------------------------------------------------------------------- */
/*  Sort                                                                     */
/* ------------------------------------------------------------------------- */

export interface SortOption {
  value: string;
  label: string;
  hint?: string;
}

export const SORTS: SortOption[] = [
  { value: "newest", label: "Newest" },
  { value: "for_you", label: "For you", hint: "personalized" },
  { value: "rating", label: "Top Rated" },
  { value: "sale", label: "Biggest Sale" },
  { value: "price_asc", label: "Price: Low" },
  { value: "price_desc", label: "Price: High" },
];

/* ------------------------------------------------------------------------- */
/*  View modes                                                               */
/* ------------------------------------------------------------------------- */

export type ViewMode = "grid" | "list" | "editorial";

export const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: "grid", label: "Grid", icon: "grid-outline" },
  { value: "list", label: "List", icon: "list-outline" },
  { value: "editorial", label: "Editorial", icon: "book-outline" },
];

/** Toggle helper. Returns a new array with `value` added if missing
 *  or removed if already present. */
export function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/* ------------------------------------------------------------------------- */
/*  Full product filter shape (used by page + filter sheet)                  */
/* ------------------------------------------------------------------------- */

export interface ProductFilters {
  gender?: string;
  price?: [number, number];
  brands?: string[];
  categories?: string[];
  colors?: string[];
  sizes?: string[];
  occasion?: string;
  material?: string;
  minRating?: number;
  minDiscount?: number;
}

/* ------------------------------------------------------------------------- */
/*  AI-extracted attr facets (GLM vision ingest)                             */
/* ------------------------------------------------------------------------- */

/** Canonical occasion chips (AI-extracted, normalized) — reveal-if-present. */
export const OCCASIONS = OCCASION_OPTS;

/** Canonical material chips (AI-extracted, normalized) — reveal-if-present. */
export const MATERIALS = MATERIAL_OPTS;

export const EMPTY_FILTERS: ProductFilters = {
  price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
  brands: [],
  categories: [],
  colors: [],
  sizes: [],
  minRating: 0,
  minDiscount: 0,
};

/** Price refinement for a "Shop by price" band; an unbounded side uses the catalogue bound. */
export function priceFilterFor(minPrice?: number, maxPrice?: number): [number, number] {
  if (minPrice == null && maxPrice == null) return [PRICE_BOUNDS.min, PRICE_BOUNDS.max];
  return [minPrice ?? PRICE_BOUNDS.min, maxPrice ?? PRICE_BOUNDS.max];
}

export function filtersEqual(a: ProductFilters, b: ProductFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function activeFilterCount(f: ProductFilters): number {
  let n = 0;
  if (f.gender) n += 1;
  if (f.price && (f.price[0] > PRICE_BOUNDS.min || f.price[1] < PRICE_BOUNDS.max)) n += 1;
  n += f.brands?.length ?? 0;
  n += f.categories?.length ?? 0;
  n += f.colors?.length ?? 0;
  n += f.sizes?.length ?? 0;
  if (f.minRating && f.minRating > 0) n += 1;
  if (f.minDiscount && f.minDiscount > 0) n += 1;
  return n;
}
