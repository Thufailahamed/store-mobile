/**
 * Shared facet constants for the search/filter UI.
 * Mirrors `store/src/components/search/facet-data.ts` but RN-native.
 */

export interface FacetColor {
  name: string;
  hex: string;
}

export const COLORS: FacetColor[] = [
  { name: "Black", hex: "#16170f" },
  { name: "White", hex: "#f5f4ef" },
  { name: "Olive", hex: "#535e2c" },
  { name: "Sand", hex: "#cccca0" },
  { name: "Rust", hex: "#b85c3a" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Pink", hex: "#e2a4b8" },
  { name: "Grey", hex: "#7a7a72" },
];

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
  minRating?: number;
  minDiscount?: number;
}

export const EMPTY_FILTERS: ProductFilters = {
  price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
  brands: [],
  categories: [],
  colors: [],
  sizes: [],
  minRating: 0,
  minDiscount: 0,
};

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
